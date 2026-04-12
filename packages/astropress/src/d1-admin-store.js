import { createD1ContentReadPart, createD1SchedulingPart } from "./d1-store-content.js";
import { createD1AuthorsReadPart, createD1AuthorsMutationPart, createD1TaxonomiesReadPart, createD1TaxonomiesMutationPart } from "./d1-store-taxonomies.js";
import { createD1OperationsReadPart, createD1OperationsMutationPart } from "./d1-store-operations.js";

export function createD1AdminReadStore(db) {
  return {
    ...createD1OperationsReadPart(db),
    authors: createD1AuthorsReadPart(db),
    taxonomies: createD1TaxonomiesReadPart(db),
    content: { ...createD1ContentReadPart(db), ...createD1SchedulingPart(db) },
  };
}

export function createD1AdminMutationStore(db) {
  return {
    authors: createD1AuthorsMutationPart(db),
    taxonomies: createD1TaxonomiesMutationPart(db),
    ...createD1OperationsMutationPart(db),
  };
}
