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
  embedFragments,
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

export { seedMemory, getSeedCount, getSeedIds } from "./seed.js";

export { initEmbeddings, isEmbeddingsReady, embed, cosineSimilarity, searchByVector, hybridSearch } from "./embeddings.js";
