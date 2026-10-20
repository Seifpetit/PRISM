import { api, type AiModelInput, type ProductMediaAsset } from "@/api/api";
import { mockRequest } from "@/services/mock-client";
import type { Product, ProductContext, ProductSource, UrlInspectionResult } from "@/types/strategy";

export async function inspectProductUrl(url: string): Promise<UrlInspectionResult> {
  return mockRequest(() => api.inspectProductUrl({ url }), 0);
}

export async function addProductUrl(url: string): Promise<ProductSource> {
  return mockRequest(() => api.ingestProductSource({ url }), 500);
}

export async function buildProductContext(
  sources: ProductSource[],
  ai?: AiModelInput,
): Promise<ProductContext> {
  return mockRequest(() => api.buildProductContext({ sources, ai }), 1400);
}

export async function getProducts(): Promise<Product[]> {
  return mockRequest(() => api.products(), 180);
}

export async function createProduct(input: {
  brandId: string;
  name: string;
  description: string;
  contextId?: string;
  imageUrl?: string | null;
}): Promise<Product> {
  return mockRequest(() => api.createProduct(input), 450);
}

export async function generateProductImage(id: string): Promise<Product> {
  return mockRequest(() => api.generateProductImage({ id }), 1400);
}

export async function setProductImage(id: string, imageUrl: string): Promise<Product> {
  return mockRequest(() => api.setProductImage({ id, imageUrl }), 300);
}

export async function getProductMedia(productId: string): Promise<ProductMediaAsset[]> {
  return mockRequest(() => api.productMedia({ productId }), 200);
}
