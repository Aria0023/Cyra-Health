// Storage adapter interface. Default: JSON file store (zero-config).
// Swap for Postgres/DynamoDB by implementing the same four methods and
// changing `storage.driver` in config/app.json. Nothing else changes.
import fs from "fs";
import path from "path";

export class JsonStore {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.cache = {};
  }
  _file(coll) {
    return path.join(this.dir, `${coll}.json`);
  }
  _load(coll) {
    if (!this.cache[coll]) {
      try {
        this.cache[coll] = JSON.parse(fs.readFileSync(this._file(coll), "utf8"));
      } catch {
        this.cache[coll] = [];
      }
    }
    return this.cache[coll];
  }
  _save(coll) {
    fs.writeFileSync(this._file(coll), JSON.stringify(this.cache[coll], null, 2));
  }
  async insert(coll, doc) {
    const rows = this._load(coll);
    rows.push(doc);
    this._save(coll);
    return doc;
  }
  async find(coll, pred = () => true) {
    return this._load(coll).filter(pred);
  }
  async findOne(coll, pred) {
    return this._load(coll).find(pred) || null;
  }
  async update(coll, pred, patch) {
    const rows = this._load(coll);
    let n = 0;
    rows.forEach((r, i) => {
      if (pred(r)) {
        rows[i] = { ...r, ...patch };
        n++;
      }
    });
    this._save(coll);
    return n;
  }
}

export function createStore(config) {
  const driver = config.storage?.driver || "json";
  if (driver === "json") return new JsonStore(config.storage?.dir || "./data");
  throw new Error(`Unknown storage driver: ${driver} — implement it in src/core/store.js`);
}
