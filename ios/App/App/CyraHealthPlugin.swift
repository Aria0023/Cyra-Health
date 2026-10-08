import Foundation
import Capacitor
import HealthKit

/// Cyra's read-only bridge to Apple Health ("CyraHealth" in JS).
///
/// JS side (src/lib/native.js) reaches it through `registerPlugin("CyraHealth")` from
/// @capacitor/core, which gives a proxy that works the same on every platform. (On iOS
/// the bridge also injects a `window.Capacitor.Plugins.CyraHealth` stub at document
/// start once the plugin is registered, but the app does not rely on it.)
///
/// Contract (all promise methods):
///   available()            -> { available: boolean }
///   requestAuthorization() -> { granted: boolean }
///   readDaily({ from: "YYYY-MM-DD", to: "YYYY-MM-DD" })
///     -> { days: [{ date, temp, rhr, hrv, sleep }], needsAuthorization: boolean }
///        (null where there is no value). needsAuthorization is true when Cyra never
///        asked for at least one of the types (for example wrist temperature after an
///        upgrade from iOS 15); those values are null and the other values are still
///        returned. Call requestAuthorization() again and re-read. When Cyra never asked
///        for ANY of the types, readDaily rejects instead.
///
/// Privacy: everything here runs on this device. Nothing is written to Health
/// (read access only) and nothing is sent anywhere; rows go straight back to the
/// web view, which keeps them in the on-device record.
///
/// Registered on the bridge by CyraViewController.capacitorDidLoad().
@objc(CyraHealthPlugin)
public class CyraHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CyraHealthPlugin"
    public let jsName = "CyraHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDaily", returnType: CAPPluginReturnPromise)
    ]

    /// Longest range one readDaily call may cover. The app asks for about 31 days.
    static let maxRangeDays = 366

    /// One long-lived store for the plugin's lifetime, created on first use and
    /// only where HealthKit is available. Capacitor invokes plugin methods on the
    /// bridge's serial queue, so this lazy creation is never raced.
    private var store: HKHealthStore?

    private func healthStore() -> HKHealthStore? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        if let store = store { return store }
        let created = HKHealthStore()
        store = created
        return created
    }

    /// The types Cyra reads. Sleeping wrist temperature exists from iOS 16 on;
    /// on iOS 15 it is simply not requested and every row's temp is null.
    static func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let restingHeartRate = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            types.insert(restingHeartRate)
        }
        if let heartRateVariability = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            types.insert(heartRateVariability)
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleep)
        }
        if #available(iOS 16.0, *) {
            if let wristTemperature = HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature) {
                types.insert(wristTemperature)
            }
        }
        return types
    }

    // MARK: - available()

    @objc func available(_ call: CAPPluginCall) {
        // false on iPads before iPadOS 17 and where a device policy restricts HealthKit;
        // true on iPhone and on iPads with iPadOS 17 or later.
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    // MARK: - requestAuthorization()

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard let store = healthStore() else {
            call.reject("Health data isn't available on this device.")
            return
        }
        // Read-only: toShare is empty, so Info.plist needs NSHealthShareUsageDescription
        // only (no NSHealthUpdateUsageDescription) and Cyra can never write to Health.
        store.requestAuthorization(toShare: [], read: CyraHealthPlugin.readTypes()) { success, error in
            // HealthKit calls this on a background queue once the person has answered the
            // sheet (or straight away if every type was already answered).
            //
            // `success` only says the request was processed. HealthKit never reveals
            // whether READ access was granted: "To help prevent possible leaks of
            // sensitive health information, your app cannot determine whether or not a
            // user has granted permission to read data." A type the person declined just
            // reads as empty. So granted: true means "the request completed", not
            // "every type was allowed"; readDaily returning no rows is the only signal.
            if let error = error {
                call.reject("Cyra couldn't ask for access to your Health data. Please try again.", nil, error)
                return
            }
            guard success else {
                call.reject("Cyra couldn't ask for access to your Health data. Please try again.")
                return
            }
            call.resolve(["granted": true])
        }
    }

    // MARK: - readDaily({ from, to })

    @objc func readDaily(_ call: CAPPluginCall) {
        guard let store = healthStore() else {
            call.reject("Health data isn't available on this device.")
            return
        }
        let calendar = DayMath.calendar()
        guard let fromText = call.getString("from"), let toText = call.getString("to"),
              let from = DayMath.startOfDay(parsing: fromText, in: calendar),
              let to = DayMath.startOfDay(parsing: toText, in: calendar) else {
            call.reject("readDaily needs from and to as YYYY-MM-DD dates.")
            return
        }
        guard from <= to else {
            call.reject("readDaily needs from to be on or before to.")
            return
        }
        guard let span = calendar.dateComponents([.day], from: from, to: to).day,
              span < CyraHealthPlugin.maxRangeDays else {
            call.reject("readDaily can read at most \(CyraHealthPlugin.maxRangeDays) days at a time.")
            return
        }
        guard let end = DayMath.startOfDay(from: to, addingDays: 1, in: calendar),
              let baselineStart = DayMath.startOfDay(from: from, addingDays: -DailyReader.baselineDays, in: calendar) else {
            call.reject("readDaily couldn't work out that date range.")
            return
        }

        // All queries run on HealthKit's background queues; nothing here blocks the main
        // thread or the bridge queue. The call resolves exactly once, when all are done.
        let reader = DailyReader(store: store, calendar: calendar, from: from, to: to, end: end, baselineStart: baselineStart)
        reader.run { outcome in
            switch outcome {
            case .rows(let days, let needsAuthorization):
                call.resolve(["days": days, "needsAuthorization": needsAuthorization])
            case .failed(let message, let error):
                call.reject(message, nil, error)
            }
        }
    }
}

// MARK: - Day arithmetic

/// Local calendar days for the bridge contract.
enum DayMath {
    /// Gregorian calendar in the device's current time zone.
    ///
    /// The contract's dates are ISO (Gregorian) YYYY-MM-DD local dates. Calendar.current
    /// can be Buddhist, Japanese and so on, which would misread an ISO year number, so the
    /// identifier is pinned to Gregorian. Local midnight, and so every day boundary, is the
    /// same in every calendar for a given time zone, so the days match Calendar.current's.
    static func calendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone.current
        return calendar
    }

    /// "2026-10-08" -> local midnight that starts that day, or nil if the text isn't a real date.
    static func startOfDay(parsing text: String, in calendar: Calendar) -> Date? {
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        guard text.count == 10,
              text.allSatisfy({ $0 == "-" || ($0.isASCII && $0.isNumber) }),
              parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else {
            return nil
        }
        // Build noon first: midnight itself does not exist on days where a time-zone
        // change happens at 00:00, but noon always does.
        guard let noon = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) else {
            return nil
        }
        let check = calendar.dateComponents([.year, .month, .day], from: noon)
        guard check.year == year, check.month == month, check.day == day else {
            return nil // e.g. 2026-02-30
        }
        return calendar.startOfDay(for: noon)
    }

    /// Start of the day `days` calendar days after the day starting at `dayStart`.
    static func startOfDay(from dayStart: Date, addingDays days: Int, in calendar: Calendar) -> Date? {
        // Step from midday so a daylight-saving jump can never land on the wrong day.
        guard let midday = calendar.date(byAdding: .hour, value: 12, to: dayStart),
              let shifted = calendar.date(byAdding: .day, value: days, to: midday) else {
            return nil
        }
        return calendar.startOfDay(for: shifted)
    }

    /// The local calendar day containing `date`, as "YYYY-MM-DD".
    static func key(for date: Date, in calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04ld-%02ld-%02ld", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

// MARK: - One readDaily run

/// Runs the HealthKit queries for one readDaily call concurrently and folds them into
/// per-day rows.
///
/// How each value is derived, per local calendar day D in [from, to]:
///
/// - rhr: mean of D's restingHeartRate samples in count/min, rounded to a whole bpm.
///   HKStatisticsCollectionQuery with .discreteAverage over one-day intervals anchored at
///   local midnight. HealthKit assigns samples to the intervals.
///
/// - hrv: mean of D's heartRateVariabilitySDNN samples in milliseconds, rounded. Note that
///   HealthKit's HRV is SDNN (standard deviation of beat-to-beat intervals), while Oura and
///   Terra report RMSSD. The two are different statistics and SDNN usually reads higher, so
///   compare a person's HRV only with itself from the same source, never across sources.
///
/// - temp: that night's appleSleepingWristTemperature (absolute °C; Apple Watch records one
///   aggregated value per night, iOS 16+) minus a personal baseline, rounded to 2 decimals.
///   A night belongs to the day its sample ENDS on (the wake-up morning); several samples on
///   one day are averaged. Baseline = mean of the wrist-temperature samples ending in the 60
///   days before `from`. With fewer than 5 of those, it falls back to the mean of all samples
///   in [from, to]. No samples at all, or iOS 15, gives temp: null.
///
/// - sleep: round(100 × asleep ÷ in bed), capped to 0...100, over sleepAnalysis samples whose
///   END falls on D (last night plus any nap that day).
///     asleep = time covered by asleepUnspecified, asleepCore, asleepDeep and asleepREM
///       samples (iOS 16+). On iOS 15 the only sleep value is the old `.asleep`, which iOS 16
///       renamed asleepUnspecified (same raw value).
///     in bed = time covered by inBed samples. If D has none, the span from the first asleep
///       start to the last asleep end. Asleep runs more than 2 hours apart (a night and a nap)
///       are spanned separately, so the daytime between them isn't counted as time in bed.
///     Overlapping samples (several sources, such as Watch, iPhone and other apps, can record
///       the same night) are merged, so time is never counted twice. awake samples count
///       toward neither total. null when D has no asleep time.
///
/// A day appears only if at least one of the four values is non-null.
private final class DailyReader {
    enum Outcome {
        case rows([[String: Any]], needsAuthorization: Bool)
        case failed(String, Error?)
    }

    /// Days before `from` whose wrist-temperature samples form the personal baseline.
    static let baselineDays = 60
    /// Fewest baseline samples trusted; below this the requested range's own mean is used.
    static let minBaselineSamples = 5
    /// Asleep runs further apart than this are separate sleep periods (night vs nap).
    static let sleepPeriodGap: TimeInterval = 2 * 60 * 60

    private let store: HKHealthStore
    private let calendar: Calendar
    private let from: Date          // start of the first requested day
    private let to: Date            // start of the last requested day
    private let end: Date           // start of the day after `to` (exclusive)
    private let baselineStart: Date // start of the day `baselineDays` before `from`

    // Everything below is touched only on `queue`.
    private let queue = DispatchQueue(label: "com.cyrahealth.app.CyraHealth.readDaily")
    private var restingHeartRate: [String: Double] = [:]
    private var heartRateVariability: [String: Double] = [:]
    private var temperatureByDay: [String: [Double]] = [:]
    private var temperatureBaselineSamples: [Double] = []
    private var sleepSamples: [HKCategorySample] = []
    private var errors: [Error] = []
    /// Errors of queries that answered errorAuthorizationNotDetermined.
    private var notDetermined: [Error] = []
    /// Queries started. The one exception to the rule above: run() counts it on the calling
    /// thread before group.notify is registered, and only finish() (on `queue`, after
    /// every query has left the group) reads it.
    private var queriesStarted = 0

    init(store: HKHealthStore, calendar: Calendar, from: Date, to: Date, end: Date, baselineStart: Date) {
        self.store = store
        self.calendar = calendar
        self.from = from
        self.to = to
        self.end = end
        self.baselineStart = baselineStart
    }

    /// Starts every query at once and calls `completion` exactly once, on a background
    /// queue, after the last one has answered. The query handlers keep this object alive
    /// until then.
    func run(completion: @escaping (Outcome) -> Void) {
        let group = DispatchGroup()
        dailyAverage(.restingHeartRate, unit: HKUnit.count().unitDivided(by: HKUnit.minute()), group: group) { values in
            self.restingHeartRate = values
        }
        dailyAverage(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), group: group) { values in
            self.heartRateVariability = values
        }
        if #available(iOS 16.0, *) {
            wristTemperature(group: group)
        }
        sleepAnalysis(group: group)
        group.notify(queue: queue) {
            completion(self.finish())
        }
    }

    // MARK: Queries

    /// Per-day discrete average of a quantity type over [from, end).
    private func dailyAverage(_ identifier: HKQuantityTypeIdentifier, unit: HKUnit, group: DispatchGroup,
                              into result: @escaping ([String: Double]) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return }
        queriesStarted += 1
        group.enter()
        let predicate = HKQuery.predicateForSamples(withStart: from, end: end, options: .strictStartDate)
        let query = HKStatisticsCollectionQuery(quantityType: type,
                                                quantitySamplePredicate: predicate,
                                                options: .discreteAverage,
                                                anchorDate: from,
                                                intervalComponents: DateComponents(day: 1))
        // No statisticsUpdateHandler is set, so the query stops after its initial results.
        query.initialResultsHandler = { _, collection, error in
            var values: [String: Double] = [:]
            if let collection = collection {
                collection.enumerateStatistics(from: self.from, to: self.to) { statistics, _ in
                    guard let average = statistics.averageQuantity() else { return }
                    // Key by the interval's midpoint so a boundary that lands an hour off
                    // (a daylight-saving change) still names the right day.
                    let middle = statistics.startDate.addingTimeInterval(
                        statistics.endDate.timeIntervalSince(statistics.startDate) / 2)
                    values[DayMath.key(for: middle, in: self.calendar)] = average.doubleValue(for: unit)
                }
            }
            let found = values
            self.queue.async {
                if let error = error {
                    self.record(error)
                } else {
                    result(found)
                }
                group.leave()
            }
        }
        store.execute(query)
    }

    /// Wrist-temperature samples ending in [baselineStart, end): before `from` they feed
    /// the baseline, otherwise they are a day's reading.
    @available(iOS 16.0, *)
    private func wristTemperature(group: DispatchGroup) {
        guard let type = HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature) else { return }
        queriesStarted += 1
        group.enter()
        let predicate = HKQuery.predicateForSamples(withStart: baselineStart, end: end, options: .strictEndDate)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: nil) { _, samples, error in
            let celsius = HKUnit.degreeCelsius()
            self.queue.async {
                if let error = error {
                    self.record(error)
                }
                for case let sample as HKQuantitySample in samples ?? [] {
                    let value = sample.quantity.doubleValue(for: celsius)
                    if sample.endDate < self.from {
                        self.temperatureBaselineSamples.append(value)
                    } else {
                        self.temperatureByDay[DayMath.key(for: sample.endDate, in: self.calendar), default: []].append(value)
                    }
                }
                group.leave()
            }
        }
        store.execute(query)
    }

    /// Sleep-analysis samples whose end falls in [from, end).
    private func sleepAnalysis(group: DispatchGroup) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return }
        queriesStarted += 1
        group.enter()
        let predicate = HKQuery.predicateForSamples(withStart: from, end: end, options: .strictEndDate)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: nil) { _, samples, error in
            self.queue.async {
                if let error = error {
                    self.record(error)
                }
                self.sleepSamples = (samples ?? []).compactMap { $0 as? HKCategorySample }
                group.leave()
            }
        }
        store.execute(query)
    }

    // MARK: Folding into rows (runs on `queue`)

    /// Sorts one query's error. No data is an empty answer. Authorization not determined
    /// (Cyra never asked for this type, for example wrist temperature after an upgrade from
    /// iOS 15, or a type added in a later Cyra version) costs only that type's values.
    /// Anything else fails the call.
    private func record(_ error: Error) {
        if DailyReader.isNoData(error) { return }
        if DailyReader.isNotDetermined(error) {
            notDetermined.append(error)
        } else {
            errors.append(error)
        }
    }

    private func finish() -> Outcome {
        if let first = errors.first {
            if errors.contains(where: DailyReader.isLocked) {
                return .failed("Unlock your device so Cyra can read your Health data, then try again.", first)
            }
            return .failed("Cyra couldn't read your Health data just now. Please try again.", first)
        }
        if let first = notDetermined.first, notDetermined.count >= queriesStarted {
            return .failed("Cyra needs your permission to read Health data first.", first)
        }

        let baseline = temperatureBaseline()
        let sleepScores = sleepScoresByDay()
        let days = Set(restingHeartRate.keys)
            .union(heartRateVariability.keys)
            .union(temperatureByDay.keys)
            .union(sleepScores.keys)
            .sorted() // "YYYY-MM-DD" sorts chronologically

        var rows: [[String: Any]] = []
        for day in days {
            var temp: Double?
            if let baseline = baseline, let readings = temperatureByDay[day], !readings.isEmpty {
                temp = ((DailyReader.mean(readings) - baseline) * 100).rounded() / 100
            }
            let rhr = restingHeartRate[day].map { Int($0.rounded()) }
            let hrv = heartRateVariability[day].map { Int($0.rounded()) }
            let sleep = sleepScores[day]
            if temp == nil && rhr == nil && hrv == nil && sleep == nil { continue }
            rows.append([
                "date": day,
                "temp": temp.map { $0 as Any } ?? NSNull(),
                "rhr": rhr.map { $0 as Any } ?? NSNull(),
                "hrv": hrv.map { $0 as Any } ?? NSNull(),
                "sleep": sleep.map { $0 as Any } ?? NSNull()
            ])
        }
        return .rows(rows, needsAuthorization: !notDetermined.isEmpty)
    }

    /// Personal wrist-temperature baseline in °C, or nil when there are no samples at all.
    private func temperatureBaseline() -> Double? {
        if temperatureBaselineSamples.count >= DailyReader.minBaselineSamples {
            return DailyReader.mean(temperatureBaselineSamples)
        }
        let inRange = temperatureByDay.values.flatMap { $0 }
        return inRange.isEmpty ? nil : DailyReader.mean(inRange)
    }

    /// Day -> 0...100 sleep score, for days that have asleep time.
    private func sleepScoresByDay() -> [String: Int] {
        var asleepByDay: [String: [DateInterval]] = [:]
        var inBedByDay: [String: [DateInterval]] = [:]
        for sample in sleepSamples where sample.endDate > sample.startDate {
            let day = DayMath.key(for: sample.endDate, in: calendar)
            let interval = DateInterval(start: sample.startDate, end: sample.endDate)
            if sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue {
                inBedByDay[day, default: []].append(interval)
            } else if DailyReader.isAsleep(sample.value) {
                asleepByDay[day, default: []].append(interval)
            }
            // awake (and any value added in a future iOS) counts toward neither total.
        }

        var scores: [String: Int] = [:]
        for (day, asleepIntervals) in asleepByDay {
            let asleep = DailyReader.coveredDuration(asleepIntervals)
            guard asleep > 0 else { continue }
            let inBed: TimeInterval
            if let inBedIntervals = inBedByDay[day], !inBedIntervals.isEmpty {
                inBed = DailyReader.coveredDuration(inBedIntervals)
            } else {
                inBed = DailyReader.periodSpans(asleepIntervals, splittingAt: DailyReader.sleepPeriodGap)
            }
            guard inBed > 0 else { continue }
            scores[day] = min(100, max(0, Int((100 * asleep / inBed).rounded())))
        }
        return scores
    }

    // MARK: Helpers

    /// asleepUnspecified, asleepCore, asleepDeep or asleepREM (iOS 16+); on iOS 15, the
    /// old `.asleep` value (iOS 16 renamed it asleepUnspecified, same raw value).
    static func isAsleep(_ rawValue: Int) -> Bool {
        if #available(iOS 16.0, *) {
            guard let value = HKCategoryValueSleepAnalysis(rawValue: rawValue) else { return false }
            switch value {
            case .asleepUnspecified, .asleepCore, .asleepDeep, .asleepREM:
                return true
            default:
                return false
            }
        }
        // iOS 15 knows only inBed, asleep and awake.
        return rawValue != HKCategoryValueSleepAnalysis.inBed.rawValue
            && rawValue != HKCategoryValueSleepAnalysis.awake.rawValue
    }

    /// Total time covered by the intervals, counting overlaps once.
    static func coveredDuration(_ intervals: [DateInterval]) -> TimeInterval {
        let sorted = intervals.sorted { $0.start < $1.start }
        guard var current = sorted.first else { return 0 }
        var total: TimeInterval = 0
        for interval in sorted.dropFirst() {
            if interval.start <= current.end {
                if interval.end > current.end { current = DateInterval(start: current.start, end: interval.end) }
            } else {
                total += current.duration
                current = interval
            }
        }
        return total + current.duration
    }

    /// Sum of (last end - first start) over runs of intervals, starting a new run when the
    /// next interval begins more than `gap` after the run's end.
    static func periodSpans(_ intervals: [DateInterval], splittingAt gap: TimeInterval) -> TimeInterval {
        let sorted = intervals.sorted { $0.start < $1.start }
        guard let first = sorted.first else { return 0 }
        var runStart = first.start
        var runEnd = first.end
        var total: TimeInterval = 0
        for interval in sorted.dropFirst() {
            if interval.start.timeIntervalSince(runEnd) > gap {
                total += runEnd.timeIntervalSince(runStart)
                runStart = interval.start
                runEnd = interval.end
            } else if interval.end > runEnd {
                runEnd = interval.end
            }
        }
        return total + runEnd.timeIntervalSince(runStart)
    }

    static func mean(_ values: [Double]) -> Double {
        values.reduce(0, +) / Double(values.count)
    }

    /// HealthKit's "no data for this query" is an empty answer, not a failure.
    static func isNoData(_ error: Error) -> Bool {
        (error as? HKError)?.code == .errorNoData
    }

    /// Health data is encrypted while the device is locked.
    static func isLocked(_ error: Error) -> Bool {
        (error as? HKError)?.code == .errorDatabaseInaccessible
    }

    static func isNotDetermined(_ error: Error) -> Bool {
        (error as? HKError)?.code == .errorAuthorizationNotDetermined
    }
}
