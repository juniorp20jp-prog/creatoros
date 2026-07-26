/**
 * ============================================================
 * CreatorOS HQ
 * Core Types
 * ============================================================
 * Este archivo contiene los tipos base utilizados por todo
 * el sistema de documentación de CreatorOS.
 */

export type DocumentCategory =
  | "constitution"
  | "blueprint"
  | "csi"
  | "backlog"
  | "roadmap"
  | "business-strategy";

export type DocumentStatus =
  | "draft"
  | "review"
  | "approved"
  | "archived";

export interface DocumentVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
}

export interface HQDocument {
  id: string;

  title: string;

  description: string;

  category: DocumentCategory;

  version: DocumentVersion;

  status: DocumentStatus;

  lastUpdated: string;

  author: string;

  sections: DocumentSection[];
}