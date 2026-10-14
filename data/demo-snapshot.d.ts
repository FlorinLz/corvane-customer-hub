// Deliberately untyped: importing the ~800 KB snapshot as .json makes TypeScript infer a type for every row, which takes minutes.
// src/server/demo-snapshot.ts gives it its real type.
declare const snapshot: unknown;
export default snapshot;
