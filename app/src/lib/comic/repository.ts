import type { ComicProject, ProjectMeta } from "./types";
import {
  deleteProject,
  getProject,
  listProjects,
  saveProject,
  getAsset,
  putAsset,
  listAssets,
  type AssetRecord,
} from "./db";

export interface ComicRepository {
  list(): Promise<ProjectMeta[]>;
  get(id: string): Promise<ComicProject | null>;
  save(project: ComicProject, extra?: Partial<ProjectMeta>): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AssetRepository {
  list(): Promise<AssetRecord[] | Awaited<ReturnType<typeof listAssets>>>;
  get(id: string): Promise<AssetRecord | null>;
  put(record: AssetRecord): Promise<void>;
}

export const indexedDbComics: ComicRepository = {
  list: listProjects,
  get: getProject,
  save: saveProject,
  remove: deleteProject,
};

export const indexedDbAssets: AssetRepository = {
  list: listAssets,
  get: getAsset,
  put: putAsset,
};
