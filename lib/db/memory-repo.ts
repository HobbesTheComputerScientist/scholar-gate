import { randomUUID } from "crypto";

import type {
  ChatMessage,
  Decision,
  Paper,
  Profile,
  Project,
  ProposedPatch,
  Summary,
} from "@/lib/db/types";
import type { DbRepo } from "@/lib/db/repo";

type Store = {
  profiles: Map<string, Profile>;
  projects: Map<string, Project>;
  papers: Map<string, Paper>;
  decisions: Map<string, Decision>;
  messages: Map<string, ChatMessage>;
  summaries: Map<string, Summary>;
  patches: Map<string, ProposedPatch>;
};

const globalForStore = globalThis as typeof globalThis & {
  __researchCoachStore?: Store;
};

function store(): Store {
  if (!globalForStore.__researchCoachStore) {
    globalForStore.__researchCoachStore = {
      profiles: new Map(),
      projects: new Map(),
      papers: new Map(),
      decisions: new Map(),
      messages: new Map(),
      summaries: new Map(),
      patches: new Map(),
    };
  }
  return globalForStore.__researchCoachStore;
}

function now() {
  return new Date().toISOString();
}

export const memoryRepo: DbRepo = {
  async upsertProfile(profile) {
    const existing = store().profiles.get(profile.id);
    const next: Profile = {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      createdAt: existing?.createdAt ?? profile.createdAt ?? now(),
    };
    store().profiles.set(profile.id, next);
    return next;
  },

  async getProfile(userId) {
    return store().profiles.get(userId) ?? null;
  },

  async listProjects(userId) {
    return [...store().projects.values()]
      .filter((project) => project.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getProject(userId, projectId) {
    const project = store().projects.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }
    return project;
  },

  async createProject({ userId, name, state }) {
    const created: Project = {
      id: randomUUID(),
      userId,
      name,
      state,
      createdAt: now(),
      updatedAt: now(),
    };
    store().projects.set(created.id, created);
    return created;
  },

  async updateProjectState(userId, projectId, state) {
    const project = await this.getProject(userId, projectId);
    if (!project) {
      throw new Error("Project not found.");
    }
    const updated = { ...project, state, updatedAt: now() };
    store().projects.set(projectId, updated);
    return updated;
  },

  async deleteProject(userId, projectId) {
    const project = await this.getProject(userId, projectId);
    if (!project) {
      return;
    }
    store().projects.delete(projectId);
    for (const [id, row] of store().papers) {
      if (row.projectId === projectId) store().papers.delete(id);
    }
    for (const [id, row] of store().decisions) {
      if (row.projectId === projectId) store().decisions.delete(id);
    }
    for (const [id, row] of store().messages) {
      if (row.projectId === projectId) store().messages.delete(id);
    }
    for (const [id, row] of store().summaries) {
      if (row.projectId === projectId) store().summaries.delete(id);
    }
    for (const [id, row] of store().patches) {
      if (row.projectId === projectId) store().patches.delete(id);
    }
  },

  async listPapers(userId, projectId) {
    return [...store().papers.values()]
      .filter((row) => row.userId === userId && row.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async insertPaper(paper) {
    const created: Paper = { ...paper, id: randomUUID(), createdAt: now() };
    store().papers.set(created.id, created);
    return created;
  },

  async listDecisions(userId, projectId) {
    return [...store().decisions.values()]
      .filter((row) => row.userId === userId && row.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async insertDecision(decision) {
    const created: Decision = {
      ...decision,
      id: randomUUID(),
      createdAt: now(),
    };
    store().decisions.set(created.id, created);
    return created;
  },

  async listRecentMessages(userId, projectId, limit) {
    return [...store().messages.values()]
      .filter((row) => row.userId === userId && row.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit);
  },

  async insertMessage(message) {
    const created: ChatMessage = {
      ...message,
      id: randomUUID(),
      createdAt: now(),
    };
    store().messages.set(created.id, created);
    return created;
  },

  async countMessages(userId, projectId) {
    return [...store().messages.values()].filter(
      (row) => row.userId === userId && row.projectId === projectId,
    ).length;
  },

  async latestSummary(userId, projectId) {
    const rows = [...store().summaries.values()]
      .filter((row) => row.userId === userId && row.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows[0] ?? null;
  },

  async insertSummary(summary) {
    const created: Summary = { ...summary, id: randomUUID(), createdAt: now() };
    store().summaries.set(created.id, created);
    return created;
  },

  async listPendingPatches(userId, projectId) {
    return [...store().patches.values()]
      .filter(
        (row) =>
          row.userId === userId &&
          row.projectId === projectId &&
          row.status === "pending",
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async insertPatch(patch) {
    const created: ProposedPatch = {
      ...patch,
      id: randomUUID(),
      status: "pending",
      createdAt: now(),
    };
    store().patches.set(created.id, created);
    return created;
  },

  async getPatch(userId, patchId) {
    const patch = store().patches.get(patchId);
    if (!patch || patch.userId !== userId) {
      return null;
    }
    return patch;
  },

  async setPatchStatus(userId, patchId, status) {
    const patch = await this.getPatch(userId, patchId);
    if (!patch) {
      throw new Error("Patch not found.");
    }
    const updated = { ...patch, status };
    store().patches.set(patchId, updated);
    return updated;
  },
};
