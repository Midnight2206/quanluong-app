import { Prisma } from "@prisma/client";
import { getAuditContext, auditStorage } from "./audit-context.js";
import { enqueueAudit } from "./audit-writer.js";
import { diffRecords, snapshot } from "./audit-redact.js";
import { delegateName, excludedModels, getModelMeta } from "./audit-model-meta.js";

const BULK_CAP = 200;

function pkWhere(meta, record) {
  if (!record || !meta.pk.length) return null;
  if (meta.pk.length === 1) {
    const v = record[meta.pk[0]];
    return v === undefined ? null : { [meta.pk[0]]: v };
  }
  const obj = {};
  for (const k of meta.pk) {
    if (record[k] === undefined) return null;
    obj[k] = record[k];
  }
  return { [meta.pk.join("_")]: obj };
}

function recordIdOf(meta, record) {
  if (!record || !meta.pk.length) return null;
  if (meta.pk.length === 1) {
    const v = record[meta.pk[0]];
    return v == null ? null : String(v).slice(0, 191);
  }
  return JSON.stringify(Object.fromEntries(meta.pk.map((k) => [k, record[k] ?? null]))).slice(0, 191);
}

function unitIdOf(meta, record, ctx) {
  if (record) {
    if (meta.name === "Unit" && record.id != null) return Number(record.id);
    if (meta.hasUnitId && record.unitId != null) return Number(record.unitId);
  }
  return ctx?.unitId ?? null;
}

function nestedOps(meta, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rel = Object.keys(data).filter((k) => meta.relations.has(k));
  return rel.length ? rel : null;
}

/**
 * @param {object} deps
 * @param {object} deps.base — client gốc (đọc trước/sau khi ghi ngoài transaction)
 * @param {(items: object[]) => void} [deps.emit]
 */
function createAuditExtension({ base, emit = (items) => enqueueAudit("changes", items) }) {
  const meta = getModelMeta();
  const excluded = excludedModels();

  const ctxNow = () => getAuditContext();
  /** Trong transaction: đọc bằng tx (cùng kết nối) và gom vào bộ đệm, chỉ ghi khi commit. */
  const reader = (ctx, model) => (ctx?.tx ?? base)[delegateName(model)];
  const out = (ctx, items) => {
    if (!items.length) return;
    if (ctx?.txBuffer) ctx.txBuffer.push(...items);
    else emit(items);
  };

  function entry(ctx, m, action, record, changes) {
    return {
      occurredAt: new Date().toISOString(),
      userId: ctx?.userId ?? null,
      unitId: unitIdOf(m, record, ctx),
      action,
      model: m.name,
      recordId: recordIdOf(m, record),
      changes,
      requestId: ctx?.requestId ? String(ctx.requestId).slice(0, 64) : null,
      route: (ctx?.route ?? "system").slice(0, 128),
      ip: ctx?.ip ? String(ctx.ip).slice(0, 45) : null,
    };
  }

  const safe = async (fn, fallback = null) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const tracked = (model) => model && !excluded.has(model) && meta.has(model) && process.env.AUDIT_ENABLED !== "false";

  return Prisma.defineExtension({
    name: "audit-log",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (!tracked(model)) return result;
          const ctx = ctxNow();
          const m = meta.get(model);
          safeSync(() => {
            const snap = snapshot(result, m.scalar);
            const nested = nestedOps(m, args?.data);
            if (nested) snap.__nested = nested;
            out(ctx, [entry(ctx, m, "CREATE", result, snap)]);
          });
          return result;
        },

        async createMany({ model, args, query }) {
          const result = await query(args);
          if (!tracked(model)) return result;
          const ctx = ctxNow();
          const m = meta.get(model);
          safeSync(() => {
            const rows = Array.isArray(args?.data) ? args.data : [args?.data];
            out(ctx, rows.slice(0, BULK_CAP).map((r) => entry(ctx, m, "CREATE", r, snapshot(r, m.scalar))));
            if (rows.length > BULK_CAP) out(ctx, [entry(ctx, m, "CREATE", null, { __bulk: true, count: rows.length, logged: BULK_CAP })]);
          });
          return result;
        },

        async createManyAndReturn({ model, args, query }) {
          const result = await query(args);
          if (!tracked(model)) return result;
          const ctx = ctxNow();
          const m = meta.get(model);
          safeSync(() => out(ctx, result.slice(0, BULK_CAP).map((r) => entry(ctx, m, "CREATE", r, snapshot(r, m.scalar)))));
          return result;
        },

        async update({ model, args, query }) {
          if (!tracked(model)) return query(args);
          const ctx = ctxNow();
          const m = meta.get(model);
          const before = await safe(() => reader(ctx, model).findUnique({ where: args.where }));
          const result = await query(args);
          const fullResult = !args.select && !args.include && !args.omit;
          const after = fullResult ? result : (await safe(() => reader(ctx, model).findUnique({ where: pkWhere(m, before ?? result) }))) ?? result;
          safeSync(() => {
            const changes = diffRecords(before, after, m.scalar);
            const nested = nestedOps(m, args?.data);
            if (nested) changes.__nested = nested;
            if (Object.keys(changes).length) out(ctx, [entry(ctx, m, "UPDATE", after ?? before, changes)]);
          });
          return result;
        },

        async upsert({ model, args, query }) {
          if (!tracked(model)) return query(args);
          const ctx = ctxNow();
          const m = meta.get(model);
          const before = await safe(() => reader(ctx, model).findUnique({ where: args.where }));
          const result = await query(args);
          const fullResult = !args.select && !args.include && !args.omit;
          const after = fullResult ? result : (await safe(() => reader(ctx, model).findUnique({ where: pkWhere(m, before ?? result) }))) ?? result;
          safeSync(() => {
            if (!before) {
              out(ctx, [entry(ctx, m, "CREATE", after, snapshot(after, m.scalar))]);
              return;
            }
            const changes = diffRecords(before, after, m.scalar);
            if (Object.keys(changes).length) out(ctx, [entry(ctx, m, "UPDATE", after, changes)]);
          });
          return result;
        },

        async delete({ model, args, query }) {
          if (!tracked(model)) return query(args);
          const ctx = ctxNow();
          const m = meta.get(model);
          const before = await safe(() => reader(ctx, model).findUnique({ where: args.where }));
          const result = await query(args);
          safeSync(() => {
            const rec = before ?? result;
            out(ctx, [entry(ctx, m, "DELETE", rec, snapshot(rec, m.scalar))]);
          });
          return result;
        },

        async updateMany({ model, args, query }) {
          if (!tracked(model)) return query(args);
          const ctx = ctxNow();
          const m = meta.get(model);
          const befores = (await safe(() => reader(ctx, model).findMany({ where: args.where, take: BULK_CAP + 1 }), [])) ?? [];
          const result = await query(args);
          if (!befores.length) return result;
          const sample = befores.slice(0, BULK_CAP);
          const afters = m.pk.length === 1
            ? (await safe(() => reader(ctx, model).findMany({ where: { [m.pk[0]]: { in: sample.map((b) => b[m.pk[0]]) } } }), [])) ?? []
            : [];
          safeSync(() => {
            const byId = new Map(afters.map((a) => [recordIdOf(m, a), a]));
            const items = [];
            for (const b of sample) {
              const a = byId.get(recordIdOf(m, b)) ?? { ...b, ...scalarData(m, args.data) };
              const changes = diffRecords(b, a, m.scalar);
              if (Object.keys(changes).length) items.push(entry(ctx, m, "UPDATE", a, changes));
            }
            if (befores.length > BULK_CAP) items.push(entry(ctx, m, "UPDATE", null, { __bulk: true, count: result?.count ?? null, logged: BULK_CAP }));
            out(ctx, items);
          });
          return result;
        },

        async deleteMany({ model, args, query }) {
          if (!tracked(model)) return query(args);
          const ctx = ctxNow();
          const m = meta.get(model);
          const befores = (await safe(() => reader(ctx, model).findMany({ where: args?.where, take: BULK_CAP + 1 }), [])) ?? [];
          const result = await query(args);
          safeSync(() => {
            const items = befores.slice(0, BULK_CAP).map((b) => entry(ctx, m, "DELETE", b, snapshot(b, m.scalar)));
            if (befores.length > BULK_CAP) items.push(entry(ctx, m, "DELETE", null, { __bulk: true, count: result?.count ?? null, logged: BULK_CAP }));
            out(ctx, items);
          });
          return result;
        },
      },
    },
  });
}

function scalarData(m, data) {
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(Object.entries(data).filter(([k, v]) => m.scalar.has(k) && (v === null || typeof v !== "object" || v instanceof Date)));
}

function safeSync(fn) {
  try {
    fn();
  } catch {
    /* nhật ký không bao giờ làm hỏng nghiệp vụ */
  }
}

/**
 * Bọc $transaction: thay đổi trong transaction chỉ được ghi khi commit; rollback → bỏ.
 * Interactive transaction: lưu `tx` vào ngữ cảnh để đọc trước/sau dùng cùng kết nối.
 */
function wrapTransaction(client, emit = (items) => enqueueAudit("changes", items)) {
  return function auditedTransaction(arg, options) {
    const parent = getAuditContext();
    const store = { ...(parent ?? {}), txBuffer: [], tx: null };
    return auditStorage.run(store, async () => {
      const result = typeof arg === "function"
        ? await client.$transaction((tx) => {
            store.tx = tx;
            return arg(tx);
          }, options)
        : await client.$transaction(arg, options);
      if (store.txBuffer.length) {
        const items = store.txBuffer;
        store.txBuffer = [];
        if (parent?.txBuffer) parent.txBuffer.push(...items);
        else emit(items);
      }
      return result;
    });
  };
}

/** Client có audit: extension + $transaction đã bọc. */
function withAudit(base, { emit } = {}) {
  const extended = base.$extends(createAuditExtension({ base, ...(emit ? { emit } : {}) }));
  const tx = wrapTransaction(extended, emit);
  return new Proxy(extended, {
    get(target, prop) {
      if (prop === "$transaction") return tx;
      const v = Reflect.get(target, prop);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

export { createAuditExtension, pkWhere, recordIdOf, withAudit, wrapTransaction };
