import type { SupabaseClient } from "@supabase/supabase-js";

import { parseProjectState } from "@/lib/db/schema";
import type { DbRepo } from "@/lib/db/repo";
import {
  PAPER_STANCES,
  type ChatMessage,
  type Decision,
  type OrientCheck,
  type Paper,
  type Profile,
  type Project,
  type ProposedPatch,
  type Summary,
} from "@/lib/db/types";

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    state: parseProjectState(row.state),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPaper(row: Record<string, unknown>): Paper {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    source: row.source as Paper["source"],
    externalId: String(row.external_id),
    title: String(row.title),
    authors: Array.isArray(row.authors)
      ? row.authors.map((author) => String(author))
      : [],
    year: typeof row.year === "number" ? row.year : null,
    abstract: row.abstract ? String(row.abstract) : null,
    url: row.url ? String(row.url) : null,
    citationCount:
      typeof row.citation_count === "number" ? row.citation_count : null,
    stance: PAPER_STANCES.includes(row.stance as Paper["stance"])
      ? (row.stance as Paper["stance"])
      : "neutral",
    doi: row.doi ? String(row.doi) : null,
    publicationYear:
      typeof row.publication_year === "number" ? row.publication_year : null,
    openAccessUrl: row.open_access_url ? String(row.open_access_url) : null,
    createdAt: String(row.created_at),
  };
}

function mapOrientCheck(row: Record<string, unknown>): OrientCheck {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    topic: String(row.topic),
    questions: Array.isArray(row.questions_json)
      ? (row.questions_json as OrientCheck["questions"])
      : [],
    studentAnswers: Array.isArray(row.student_answers_json)
      ? (row.student_answers_json as OrientCheck["studentAnswers"])
      : [],
    score: Number(row.score ?? 0),
    passed: row.passed === true,
    createdAt: String(row.created_at),
  };
}

function mapDecision(row: Record<string, unknown>): Decision {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    summary: String(row.summary),
    rationale: row.rationale ? String(row.rationale) : null,
    createdAt: String(row.created_at),
  };
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    role: row.role as ChatMessage["role"],
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

function mapSummary(row: Record<string, unknown>): Summary {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    content: String(row.content),
    messageCountAt: Number(row.message_count_at),
    createdAt: String(row.created_at),
  };
}

function mapPatch(row: Record<string, unknown>): ProposedPatch {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    tool: row.tool as ProposedPatch["tool"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as ProposedPatch["status"],
    createdAt: String(row.created_at),
  };
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    createdAt: String(row.created_at),
  };
}

export function createSupabaseRepo(client: SupabaseClient): DbRepo {
  return {
    async upsertProfile(profile) {
      const { data, error } = await client
        .from("profiles")
        .upsert({
          id: profile.id,
          email: profile.email,
          display_name: profile.displayName,
        })
        .select()
        .single();
      throwIfError(error);
      return mapProfile(data as Record<string, unknown>);
    },

    async getProfile(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      throwIfError(error);
      return data ? mapProfile(data as Record<string, unknown>) : null;
    },

    async listProjects(userId) {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      throwIfError(error);
      return (data ?? []).map((row) => mapProject(row as Record<string, unknown>));
    },

    async getProject(userId, projectId) {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .eq("id", projectId)
        .maybeSingle();
      throwIfError(error);
      return data ? mapProject(data as Record<string, unknown>) : null;
    },

    async createProject({ userId, name, state }) {
      const { data, error } = await client
        .from("projects")
        .insert({ user_id: userId, name, state })
        .select()
        .single();
      throwIfError(error);
      return mapProject(data as Record<string, unknown>);
    },

    async updateProjectState(userId, projectId, state) {
      const { data, error } = await client
        .from("projects")
        .update({ state })
        .eq("user_id", userId)
        .eq("id", projectId)
        .select()
        .single();
      throwIfError(error);
      return mapProject(data as Record<string, unknown>);
    },

    async deleteProject(userId, projectId) {
      const { error } = await client
        .from("projects")
        .delete()
        .eq("user_id", userId)
        .eq("id", projectId);
      throwIfError(error);
    },

    async listPapers(userId, projectId) {
      const { data, error } = await client
        .from("papers")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      throwIfError(error);
      return (data ?? []).map((row) => mapPaper(row as Record<string, unknown>));
    },

    async insertPaper(paper) {
      const { data, error } = await client
        .from("papers")
        .insert({
          user_id: paper.userId,
          project_id: paper.projectId,
          source: paper.source,
          external_id: paper.externalId,
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          abstract: paper.abstract,
          url: paper.url,
          citation_count: paper.citationCount,
          stance: paper.stance,
          doi: paper.doi,
          publication_year: paper.publicationYear,
          open_access_url: paper.openAccessUrl,
        })
        .select()
        .single();
      throwIfError(error);
      return mapPaper(data as Record<string, unknown>);
    },

    async updatePaperStance(userId, paperId, stance) {
      const { data, error } = await client
        .from("papers")
        .update({ stance })
        .eq("user_id", userId)
        .eq("id", paperId)
        .select()
        .single();
      throwIfError(error);
      return mapPaper(data as Record<string, unknown>);
    },

    async listOrientChecks(userId, projectId) {
      const { data, error } = await client
        .from("orient_checks")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      throwIfError(error);
      return (data ?? []).map((row) =>
        mapOrientCheck(row as Record<string, unknown>),
      );
    },

    async getOrientCheck(userId, checkId) {
      const { data, error } = await client
        .from("orient_checks")
        .select("*")
        .eq("user_id", userId)
        .eq("id", checkId)
        .maybeSingle();
      throwIfError(error);
      return data ? mapOrientCheck(data as Record<string, unknown>) : null;
    },

    async insertOrientCheck(check) {
      const { data, error } = await client
        .from("orient_checks")
        .insert({
          user_id: check.userId,
          project_id: check.projectId,
          topic: check.topic,
          questions_json: check.questions,
          student_answers_json: check.studentAnswers,
          score: check.score,
          passed: check.passed,
        })
        .select()
        .single();
      throwIfError(error);
      return mapOrientCheck(data as Record<string, unknown>);
    },

    async gradeOrientCheck(userId, checkId, result) {
      const { data, error } = await client
        .from("orient_checks")
        .update({
          student_answers_json: result.studentAnswers,
          score: result.score,
          passed: result.passed,
        })
        .eq("user_id", userId)
        .eq("id", checkId)
        .select()
        .single();
      throwIfError(error);
      return mapOrientCheck(data as Record<string, unknown>);
    },

    async listDecisions(userId, projectId) {
      const { data, error } = await client
        .from("decisions")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      throwIfError(error);
      return (data ?? []).map((row) =>
        mapDecision(row as Record<string, unknown>),
      );
    },

    async insertDecision(decision) {
      const { data, error } = await client
        .from("decisions")
        .insert({
          user_id: decision.userId,
          project_id: decision.projectId,
          summary: decision.summary,
          rationale: decision.rationale,
        })
        .select()
        .single();
      throwIfError(error);
      return mapDecision(data as Record<string, unknown>);
    },

    async listRecentMessages(userId, projectId, limit) {
      const { data, error } = await client
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
      throwIfError(error);
      return (data ?? [])
        .map((row) => mapMessage(row as Record<string, unknown>))
        .reverse();
    },

    async insertMessage(message) {
      const { data, error } = await client
        .from("messages")
        .insert({
          user_id: message.userId,
          project_id: message.projectId,
          role: message.role,
          content: message.content,
        })
        .select()
        .single();
      throwIfError(error);
      return mapMessage(data as Record<string, unknown>);
    },

    async countMessages(userId, projectId) {
      const { count, error } = await client
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("project_id", projectId);
      throwIfError(error);
      return count ?? 0;
    },

    async latestSummary(userId, projectId) {
      const { data, error } = await client
        .from("summaries")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      throwIfError(error);
      return data ? mapSummary(data as Record<string, unknown>) : null;
    },

    async insertSummary(summary) {
      const { data, error } = await client
        .from("summaries")
        .insert({
          user_id: summary.userId,
          project_id: summary.projectId,
          content: summary.content,
          message_count_at: summary.messageCountAt,
        })
        .select()
        .single();
      throwIfError(error);
      return mapSummary(data as Record<string, unknown>);
    },

    async listPendingPatches(userId, projectId) {
      const { data, error } = await client
        .from("proposed_patches")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      throwIfError(error);
      return (data ?? []).map((row) => mapPatch(row as Record<string, unknown>));
    },

    async insertPatch(patch) {
      const { data, error } = await client
        .from("proposed_patches")
        .insert({
          user_id: patch.userId,
          project_id: patch.projectId,
          tool: patch.tool,
          payload: patch.payload,
        })
        .select()
        .single();
      throwIfError(error);
      return mapPatch(data as Record<string, unknown>);
    },

    async getPatch(userId, patchId) {
      const { data, error } = await client
        .from("proposed_patches")
        .select("*")
        .eq("user_id", userId)
        .eq("id", patchId)
        .maybeSingle();
      throwIfError(error);
      return data ? mapPatch(data as Record<string, unknown>) : null;
    },

    async setPatchStatus(userId, patchId, status) {
      const { data, error } = await client
        .from("proposed_patches")
        .update({ status })
        .eq("user_id", userId)
        .eq("id", patchId)
        .select()
        .single();
      throwIfError(error);
      return mapPatch(data as Record<string, unknown>);
    },
  };
}
