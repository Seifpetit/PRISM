import { api } from "@/api/api";
import { mockRequest } from "@/services/mock-client";

export interface PerformanceSummary {
  spend: number;
  revenue: number;
  roas: number;
  winningCreativeId: string;
}

export async function getPerformance(input: { productId: string }): Promise<PerformanceSummary> {
  return mockRequest(() => api.performance(input), 220);
}
