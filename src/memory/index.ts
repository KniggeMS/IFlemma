export {
  generateId,
  detectProject,
  createFragment,
  findSimilarFragment,
  loadMemory,
  saveMemory,
  saveMemorySafe,
  applySessionDecay,
  migrateConfidenceFloor,
  filterByProject,
  decayConfidence,
  searchAndSortFragments,
  filterFragments,
  formatMemoryForLLM,
  formatMemoryDetail,
  boostOnAccess,
  recordNegativeHit,
  trackAssociations,
  addRelation,
  setMemoryDir,
  calculateStats,
  formatStats,
  auditMemory,
  formatAuditReport,
  findTopicOverlaps
} from "./core.js";

export { scanForSecrets, redactSecrets } from "./privacy.js";
