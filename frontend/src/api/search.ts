import axios from "axios";

export interface SearchResult {
  type: "transaction" | "file";
  score: number;
  transaction?: {
    id: string;
    date: string;
    label: string;
    amount_ttc: number;
    category: string;
  };
  filePath?: string;
  fileName?: string;
  extension?: string;
  excerpt?: string;
}

const api = axios.create({ baseURL: "/api" });

export async function searchWorkspace(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const { data } = await api.get<SearchResult[]>("/search", { params: { q: query } });
  return data;
}

export async function fetchAllTags(): Promise<string[]> {
  const { data } = await api.get<string[]>("/search/tags");
  return data;
}
