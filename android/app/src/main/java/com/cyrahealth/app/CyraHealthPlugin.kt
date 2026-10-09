package com.cyrahealth.app

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit
import java.util.TreeMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.roundToInt
import kotlin.reflect.KClass
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Health Connect bridge for Cyra (JS name "CyraHealth", see src/lib/wearables.js).
 *
 * Everything here runs on the phone: this class reads Health Connect and hands rows to the
 * WebView. It makes no network calls and writes nothing to Health Connect.
 *
 *   available()            -> { available: boolean }   Health Connect SDK status == SDK_AVAILABLE
 *   requestAuthorization() -> { granted: boolean, grantedTypes: string[], requestedTypes: string[] }
 *       requestedTypes: the types Cyra asks to read on this phone, as row fields: "rhr", "hrv",
 *       "sleep", plus "temp" where Health Connect supports skin temperature. grantedTypes: those
 *       of them that Health Connect says Cyra may read right now. granted: at least one is.
 *       The Health Connect permission screen opens only while some requested type isn't granted;
 *       whatever the person allows there stays allowed, even if it is only some of the types.
 *   readDaily({ from, to }) -> { days: [{ date, temp, rhr, hrv, sleep }] }
 *
 * readDaily asks Health Connect which permissions Cyra holds on every call and reads only
 * those types; a type that isn't granted is never read and stays null. It works per local
 * calendar day (ZoneId.systemDefault()) in [from, to], and only returns days with at least
 * one value:
 *   rhr   mean RestingHeartRateRecord.beatsPerMinute of records whose time falls on the day, rounded.
 *   hrv   mean HeartRateVariabilityRmssdRecord.heartRateVariabilityMillis on the day, rounded (ms).
 *   sleep round(100 * asleep / in-session) over SleepSessionRecords that END on the day, where
 *         asleep = stages SLEEPING, LIGHT, DEEP and REM (sleep efficiency, not a vendor score).
 *         Sessions without stages are skipped, so a day with only stage-less sessions is null.
 *   temp  mean SkinTemperatureRecord delta (degrees C) over records that END on the day, 2 decimals.
 *         Health Connect defines each delta as relative to the record's baseline (the source's
 *         personal baseline). Only read where FEATURE_SKIN_TEMPERATURE is available; otherwise null.
 *         With connect-client 1.1.0 (android/variables.gradle) that most likely means Android 14+
 *         only: the client's skin-temperature support for the Health Connect APK on Android 13
 *         and lower shipped in 1.2.0-alpha01, after 1.1.0 was cut. On those phones temp is always
 *         null and the temperature-based insights never fire.
 * A data type the user did not grant reads as null instead of failing the whole call.
 */
@CapacitorPlugin(name = "CyraHealth")
class CyraHealthPlugin : Plugin() {

    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.IO +
            CoroutineExceptionHandler { _, e -> Log.w(TAG, "Background task failed: ${e.javaClass.simpleName}") }
    )

    private val permissionContract: ActivityResultContract<Set<String>, Set<String>> by lazy {
        PermissionController.createRequestPermissionResultContract()
    }

    private val permissionScreenOpen = AtomicBoolean(false)

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        scope.cancel()
    }

    @PluginMethod
    fun available(call: PluginCall) {
        call.resolve(JSObject().put("available", sdkAvailable()))
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        val client = clientOrNull() ?: return call.reject(MSG_UNAVAILABLE)
        if (!permissionScreenOpen.compareAndSet(false, true)) {
            return call.reject("The Health Connect permission screen is already open")
        }
        scope.launch {
            try {
                val wanted = wantedPermissions(client)
                val held = client.permissionController.getGrantedPermissions()
                if (held.containsAll(wanted)) {
                    permissionScreenOpen.set(false)
                    call.resolve(authorizationResult(wanted, held))
                    return@launch
                }
                val intent = permissionContract.createIntent(context, wanted)
                val launched = withContext(Dispatchers.Main) {
                    startActivityForResult(call, intent, "permissionResult")
                    // Capacitor saves the call only once it has a launcher. If it had none, it has
                    // already rejected the call and returned without throwing, and permissionResult
                    // will never run, so release the latch here. (Same main-thread block, so the
                    // result callback can't run between these two lines.)
                    bridge.getSavedCall(call.callbackId) != null
                }
                if (!launched) permissionScreenOpen.set(false)
            } catch (e: CancellationException) {
                permissionScreenOpen.set(false)
                bridge.releaseCall(call)
                throw e
            } catch (e: Exception) {
                permissionScreenOpen.set(false)
                // launch() can throw after Capacitor saved the call; don't leave it retained.
                bridge.releaseCall(call)
                Log.w(TAG, "requestAuthorization failed: ${e.javaClass.simpleName}")
                call.reject("Couldn't open the Health Connect permission screen")
            }
        }
    }

    @Suppress("unused") // Called by Capacitor through @ActivityCallback.
    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        permissionScreenOpen.set(false)
        if (call == null) return
        bridge.releaseCall(call)
        val fromScreen: Set<String> = try {
            permissionContract.parseResult(result.resultCode, result.data)
        } catch (e: Exception) {
            emptySet()
        }
        val client = clientOrNull() ?: return call.resolve(authorizationResult(emptySet(), emptySet()))
        scope.launch {
            // Re-check with Health Connect itself: the screen's result only lists what changed.
            val granted = try {
                client.permissionController.getGrantedPermissions() + fromScreen
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                fromScreen
            }
            call.resolve(authorizationResult(wantedPermissions(client), granted))
        }
    }

    /**
     * { granted, grantedTypes, requestedTypes } for src/lib/wearables.js. A partial grant is
     * reported as partial (granted: true, fewer grantedTypes than requestedTypes), so the app
     * never says Cyra has no access while Health Connect still lets it read some of the
     * requested types.
     */
    private fun authorizationResult(wanted: Set<String>, held: Set<String>): JSObject {
        val requestedTypes = JSArray()
        val grantedTypes = JSArray()
        var grantedCount = 0
        for ((permission, type) in TYPE_NAMES) {
            if (permission !in wanted) continue
            requestedTypes.put(type)
            if (permission in held) {
                grantedTypes.put(type)
                grantedCount++
            }
        }
        return JSObject()
            .put("granted", grantedCount > 0)
            .put("grantedTypes", grantedTypes)
            .put("requestedTypes", requestedTypes)
    }

    @PluginMethod
    fun readDaily(call: PluginCall) {
        val from = parseDay(call.getString("from")) ?: return call.reject("from must be a date like 2026-01-31")
        val to = parseDay(call.getString("to")) ?: return call.reject("to must be a date like 2026-01-31")
        if (to.isBefore(from)) return call.reject("to must be the same day as from or later")
        if (ChronoUnit.DAYS.between(from, to) >= MAX_DAYS) return call.reject("Ask for at most $MAX_DAYS days at a time")
        val client = clientOrNull() ?: return call.reject(MSG_UNAVAILABLE)
        scope.launch {
            try {
                call.resolve(JSObject().put("days", readDays(client, from, to)))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Never log values: only the exception type.
                Log.w(TAG, "readDaily failed: ${e.javaClass.simpleName}")
                call.reject("Couldn't read from Health Connect right now. Try again in a moment.")
            }
        }
    }

    private class Day {
        var tempSum = 0.0
        var tempCount = 0
        var rhrSum = 0.0
        var rhrCount = 0
        var hrvSum = 0.0
        var hrvCount = 0
        var asleepMs = 0L
        var sessionMs = 0L
    }

    private suspend fun readDays(client: HealthConnectClient, from: LocalDate, to: LocalDate): JSArray {
        val zone = ZoneId.systemDefault()
        val start = from.atStartOfDay(zone).toInstant()
        val end = to.plusDays(1).atStartOfDay(zone).toInstant()
        // Sleep sessions and skin-temperature records count for the day they END on, so a night
        // that began the evening before `from` still belongs to `from`: read one extra day back.
        val lookBack = from.minusDays(1).atStartOfDay(zone).toInstant()

        val granted: Set<String> = try {
            client.permissionController.getGrantedPermissions()
        } catch (e: SecurityException) {
            emptySet()
        }
        val days = TreeMap<LocalDate, Day>()
        fun dayFor(t: Instant): Day? {
            val d = t.atZone(zone).toLocalDate()
            if (d.isBefore(from) || d.isAfter(to)) return null
            return days.getOrPut(d) { Day() }
        }

        if (READ_RESTING_HEART_RATE in granted) {
            readAllOrNull(client, RestingHeartRateRecord::class, start, end)?.forEach { r ->
                dayFor(r.time)?.let { it.rhrSum += r.beatsPerMinute.toDouble(); it.rhrCount++ }
            }
        }

        if (READ_HRV in granted) {
            readAllOrNull(client, HeartRateVariabilityRmssdRecord::class, start, end)?.forEach { r ->
                dayFor(r.time)?.let { it.hrvSum += r.heartRateVariabilityMillis; it.hrvCount++ }
            }
        }

        if (READ_SLEEP in granted) {
            readAllOrNull(client, SleepSessionRecord::class, lookBack, end)?.forEach { s ->
                if (s.stages.isEmpty()) return@forEach
                val sessionMs = Duration.between(s.startTime, s.endTime).toMillis()
                if (sessionMs <= 0L) return@forEach
                var asleepMs = 0L
                for (stage in s.stages) {
                    if (stage.stage !in ASLEEP_STAGES) continue
                    val a = maxOf(stage.startTime, s.startTime)
                    val b = minOf(stage.endTime, s.endTime)
                    if (b.isAfter(a)) asleepMs += Duration.between(a, b).toMillis()
                }
                dayFor(s.endTime)?.let { it.asleepMs += asleepMs; it.sessionMs += sessionMs }
            }
        }

        if (READ_SKIN_TEMPERATURE in granted && skinTemperatureSupported(client)) {
            // Optional metric: if this Health Connect version can't serve it, temp stays null.
            val records = try {
                readAll(client, SkinTemperatureRecord::class, lookBack, end)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Skin temperature unavailable: ${e.javaClass.simpleName}")
                emptyList()
            }
            for (r in records) {
                if (r.deltas.isEmpty()) continue
                val day = dayFor(r.endTime) ?: continue
                for (d in r.deltas) {
                    day.tempSum += d.delta.inCelsius
                    day.tempCount++
                }
            }
        }

        val out = JSArray()
        for ((date, d) in days) {
            val temp: Double? = if (d.tempCount > 0) Math.round(d.tempSum / d.tempCount * 100.0) / 100.0 else null
            val rhr: Int? = if (d.rhrCount > 0) (d.rhrSum / d.rhrCount).roundToInt() else null
            val hrv: Int? = if (d.hrvCount > 0) (d.hrvSum / d.hrvCount).roundToInt() else null
            val sleep: Int? = if (d.sessionMs > 0L) (100.0 * d.asleepMs / d.sessionMs).roundToInt().coerceIn(0, 100) else null
            if (temp == null && rhr == null && hrv == null && sleep == null) continue
            out.put(
                JSObject()
                    .put("date", date.toString())
                    .put("temp", temp ?: JSONObject.NULL)
                    .put("rhr", rhr ?: JSONObject.NULL)
                    .put("hrv", hrv ?: JSONObject.NULL)
                    .put("sleep", sleep ?: JSONObject.NULL)
            )
        }
        return out
    }

    /** All pages of one record type; null if Health Connect refuses access (permission revoked, app in background). */
    private suspend fun <T : Record> readAllOrNull(client: HealthConnectClient, type: KClass<T>, start: Instant, end: Instant): List<T>? =
        try {
            readAll(client, type, start, end)
        } catch (e: SecurityException) {
            null
        }

    private suspend fun <T : Record> readAll(client: HealthConnectClient, type: KClass<T>, start: Instant, end: Instant): List<T> {
        val out = ArrayList<T>()
        var pageToken: String? = null
        var pages = 0
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    pageToken = pageToken,
                )
            )
            out.addAll(response.records)
            pageToken = response.pageToken
            pages++
            // Some Health Connect versions end pagination with "" instead of null.
        } while (!pageToken.isNullOrEmpty() && pages < MAX_PAGES)
        return out
    }

    private fun sdkAvailable(): Boolean =
        try {
            HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
        } catch (e: Exception) {
            false
        }

    private fun clientOrNull(): HealthConnectClient? =
        if (!sdkAvailable()) {
            null
        } else {
            try {
                HealthConnectClient.getOrCreate(context.applicationContext)
            } catch (e: Exception) {
                null
            }
        }

    private fun skinTemperatureSupported(client: HealthConnectClient): Boolean =
        try {
            client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_SKIN_TEMPERATURE) ==
                HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
        } catch (e: Exception) {
            false
        }

    /** Read-only permissions; skin temperature only where this Health Connect supports it. */
    private fun wantedPermissions(client: HealthConnectClient): Set<String> =
        if (skinTemperatureSupported(client)) BASE_PERMISSIONS + READ_SKIN_TEMPERATURE else BASE_PERMISSIONS

    private fun parseDay(value: String?): LocalDate? =
        try {
            if (value == null) null else LocalDate.parse(value)
        } catch (e: DateTimeParseException) {
            null
        }

    companion object {
        private const val TAG = "CyraHealth"
        private const val MSG_UNAVAILABLE = "Health Connect isn't available on this phone"
        private const val MAX_DAYS = 366
        private const val MAX_PAGES = 500

        private val READ_RESTING_HEART_RATE = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        private val READ_HRV = HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class)
        private val READ_SLEEP = HealthPermission.getReadPermission(SleepSessionRecord::class)
        private val READ_SKIN_TEMPERATURE = HealthPermission.getReadPermission(SkinTemperatureRecord::class)
        private val BASE_PERMISSIONS = setOf(READ_RESTING_HEART_RATE, READ_HRV, READ_SLEEP)

        /** Each read permission and the row field it fills (the names requestAuthorization reports). */
        private val TYPE_NAMES = listOf(
            READ_RESTING_HEART_RATE to "rhr",
            READ_HRV to "hrv",
            READ_SLEEP to "sleep",
            READ_SKIN_TEMPERATURE to "temp",
        )

        private val ASLEEP_STAGES = setOf(
            SleepSessionRecord.STAGE_TYPE_SLEEPING,
            SleepSessionRecord.STAGE_TYPE_LIGHT,
            SleepSessionRecord.STAGE_TYPE_DEEP,
            SleepSessionRecord.STAGE_TYPE_REM,
        )
    }
}
