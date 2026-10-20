"use client";

// New Product intake screen.

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Image,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { unzip } from "fflate";
import { GenerationControl } from "@/components/generation-control";
import { BuildContext, type ProductContextFlowState } from "@/components/new-product/build-context";
import {
  ProductWorkbench,
  type ProductWorkbenchStage,
} from "@/components/new-product/product-workbench";
import { MaterialIntake } from "@/components/new-product/material-intake";
import { openGoogleDrivePicker } from "@/components/integrations/google-drive-picker";
import { api, type AiModelInput } from "@/api/api";
import { h } from "@/lib/h";
import {
  firstCompatibleModel,
  leastExpensiveCompatibleModel,
  modelDisplayName,
  productContextCompatibilityIssues,
  productContextIncompatibilityMessage,
} from "@/lib/product-source-capabilities";
import { addProductUrl } from "@/services/products";
import {
  AI_MODEL_OPTIONS,
  ListingScope,
  PageClassification,
  type AiProvider,
  type ProductSource,
  type ProductSourceType,
  UrlFetchStatus,
} from "@/types/strategy";

type BuildContextRequest = {
  ai: AiModelInput;
  simulateError: boolean;
  sources: ProductSource[];
};

type ModelCompatibilityNotice = { message: string };

const sourceMeta: Record<ProductSourceType, { label: string; icon: typeof Link2 }> = {
  url: { label: "Product page", icon: Link2 },
  file: { label: "Product document", icon: FileText },
  image: { label: "Product image", icon: Image },
  video: { label: "Product video", icon: Video },
  text: { label: "Product notes", icon: FileText },
};

const maxDocumentBytes = 8 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;
const maxVideoBytes = 200 * 1024 * 1024;
const videoFrameTimes = [0.15, 0.5, 0.85];

/** Keeps long Tailwind class lists readable without changing the rendered value. */
function cn(...classNames: string[]) {
  return classNames.join(" ");
}

function formatSize(bytes = 0) {
  if (!bytes) return "—";

  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function sourceIcon(type: ProductSourceType) {
  const Icon = sourceMeta[type].icon;
  return h(Icon, { size: 15, "aria-hidden": true });
}

function humanizeResult(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ") : "needs review";
}

function sourceDisplayName(source: ProductSource) {
  if (source.type === "url" && source.inspection?.classification === PageClassification.Product) {
    return source.label;
  }
  return source.filename ?? source.value ?? "Product notes";
}

function sourceResultSummary(source: ProductSource) {
  const inspection = source.inspection;
  if (source.type === "url" && inspection) {
    if (inspection.fetch.status === UrlFetchStatus.Unreachable) {
      return {
        label: `UNREACHABLE · ${humanizeResult(inspection.fetch.failureReason)}`,
        className: "text-[#B42318]",
        complete: false,
      };
    }
    if (inspection.classification === PageClassification.Product) {
      const confidence = Math.round((inspection.confidence ?? 0) * 100);
      return {
        label: `PRODUCT · ${confidence}% confidence`,
        className: "text-lineage",
        complete: true,
      };
    }
    if (inspection.classification === PageClassification.Listing) {
      const count = inspection.candidates.length;
      const scope =
        inspection.listingScope === ListingScope.BroadCatalog
          ? "BROAD CATALOG"
          : inspection.listingScope === ListingScope.Unavailable
            ? "UNAVAILABLE"
            : "SELECTABLE LISTING";
      return {
        label: `${scope} · ${count} product ${count === 1 ? "candidate" : "candidates"}`,
        className: "text-[#9A6700]",
        complete: false,
      };
    }
    return {
      label: `UNKNOWN · ${humanizeResult(inspection.unknownReason)}`,
      className: "text-muted",
      complete: false,
    };
  }
  if (source.status === "error") {
    return { label: "Could not process", className: "text-[#B42318]", complete: false };
  }
  return { label: "Ready", className: "text-lineage", complete: true };
}

const zipMimeTypes = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
]);

function isZipFile(file: File) {
  return zipMimeTypes.has(file.type) || file.name.toLowerCase().endsWith(".zip");
}

const extensionMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function guessMimeType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return extensionMimeTypes[extension] ?? "application/octet-stream";
}

/** Expands a .zip into its usable member files, skipping folders and macOS/system junk. */
function unzipFile(file: File) {
  return file
    .arrayBuffer()
    .then(
      (buffer) =>
        new Promise<File[]>((resolve, reject) => {
          unzip(new Uint8Array(buffer), (error, entries) => {
            if (error) {
              reject(new Error(`Could not open ${file.name}: ${error.message}`));
              return;
            }
            const files = Object.entries(entries)
              .filter(([path, data]) => {
                const name = path.split("/").pop() ?? "";
                return (
                  data.length > 0 &&
                  !path.endsWith("/") &&
                  !path.startsWith("__MACOSX/") &&
                  !name.startsWith(".")
                );
              })
              .map(([path, data]) => {
                const name = path.split("/").pop() ?? path;
                return new File([new Uint8Array(data)], name, { type: guessMimeType(name) });
              });
            resolve(files);
          });
        }),
    );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function once(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onFailure = () => {
      cleanup();
      reject(new Error("The video could not be decoded in this browser."));
    };
    const cleanup = () => {
      target.removeEventListener(event, onSuccess);
      target.removeEventListener("error", onFailure);
    };
    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener("error", onFailure, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.01) return;
  const seeked = once(video, "seeked");
  video.currentTime = time;
  await seeked;
}

async function extractVideoFrames(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = objectUrl;

  try {
    const metadata = once(video, "loadedmetadata");
    video.load();
    await metadata;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("The video duration could not be read.");
    }

    const width = Math.min(video.videoWidth, 1280);
    const height = Math.max(1, Math.round(video.videoHeight * (width / video.videoWidth)));
    if (!width || !height) throw new Error("The video has no usable visual frames.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not extract video frames.");

    const frames: string[] = [];
    for (const ratio of videoFrameTimes) {
      const time = Math.min(
        Math.max(video.duration * ratio, 0),
        Math.max(video.duration - 0.05, 0),
      );
      await seekVideo(video, time);
      context.drawImage(video, 0, 0, width, height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

export function EmptyProduct(props: {
  /** TEMPORARY (dev-only): lets the dev stage nav also jump to the sign-in page. */
  onDevPreviewSignIn?: () => void;
}) {
  const { onDevPreviewSignIn } = props;
  // Intake state and local input values.
  const [sources, setSources] = useState<ProductSource[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false);
  const [modelCompatibilityNotice, setModelCompatibilityNotice] =
    useState<ModelCompatibilityNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftConfirmation, setDraftConfirmation] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiModel, setAiModel] = useState(AI_MODEL_OPTIONS.openai[1].id);

  // DOM references and temporary client-side resources.
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<Set<string>>(new Set());
  const modelNoticeTimer = useRef<number | null>(null);
  const [buildRequest, setBuildRequest] = useState<BuildContextRequest | null>(null);
  const [productContextFlow, setProductContextFlow] = useState<ProductContextFlowState>("intake");
  // TEMPORARY (dev-only): jump straight to the post-review testing/integrations step.
  const [devStartAtExtras, setDevStartAtExtras] = useState(false);
  const [workbenchStage, setWorkbenchStage] = useState<ProductWorkbenchStage>("material");
  const hasDraftUrl = Boolean(url.trim());
  const hasDraftNotes = Boolean(description.trim());
  const hasDrafts = hasDraftUrl || hasDraftNotes;

  // Release image previews when the intake unmounts.
  useEffect(() => {
    return () => {
      previewUrls.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    };
  }, []);

  useEffect(() => {
    if (!modelCompatibilityNotice) return;
    modelNoticeTimer.current = window.setTimeout(() => setModelCompatibilityNotice(null), 5_000);
    return () => {
      if (modelNoticeTimer.current) window.clearTimeout(modelNoticeTimer.current);
    };
  }, [modelCompatibilityNotice]);

  useEffect(() => {
    const issues = productContextCompatibilityIssues(aiProvider, aiModel, sources);
    if (!issues.length) return;
    const fallback = leastExpensiveCompatibleModel(sources, aiProvider);
    if (!fallback || (fallback.provider === aiProvider && fallback.model === aiModel)) return;
    const oldModel = modelDisplayName(aiProvider, aiModel);
    setAiProvider(fallback.provider);
    setAiModel(fallback.model);
    setModelCompatibilityNotice({
      message: `We changed your model from ${oldModel} to ${modelDisplayName(fallback.provider, fallback.model)} because it can build product context with your current material.`,
    });
  }, [aiModel, aiProvider, sources]);

  function renderToast() {
    if (!draftConfirmation) return null;

    const draftLabel =
      hasDraftUrl && hasDraftNotes ? "URL and notes" : hasDraftUrl ? "URL" : "notes";

    return h(
      "div",
      {
        role: "dialog",
        "aria-label": "Unsubmitted product material",
        className: cn(
          "fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-2",
          "rounded-lg border border-[#DDE0E4] bg-white px-3.5 py-3",
          "text-xs text-ink shadow-[0_12px_30px_rgba(21,23,26,.14)]",
        ),
      },
      h(CheckCircle2, { size: 15, className: "mt-0.5 shrink-0 text-lineage" }),
      h(
        "div",
        null,
        h("p", { className: "font-semibold text-ink" }, `You have an unsubmitted ${draftLabel}.`),
        h(
          "p",
          { className: "mt-1 leading-5 text-muted" },
          "Submit it before building, or continue without it.",
        ),
        h(
          "div",
          { className: "mt-3 flex flex-wrap gap-2" },
          h(
            "button",
            {
              type: "button",
              onClick: () => void submitDraftsAndProcess(),
              className: cn(
                "rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-semibold",
                "text-white hover:bg-lineage",
              ),
            },
            "Submit drafts first",
          ),
          sources.length
            ? h(
                "button",
                {
                  type: "button",
                  onClick: ignoreDraftsAndProcess,
                  className: cn(
                    "rounded-md border border-[#DDE0E4] px-2.5 py-1.5",
                    "text-[11px] font-semibold text-muted hover:bg-canvas",
                  ),
                },
                "Ignore drafts",
              )
            : null,
        ),
      ),
    );
  }

  function renderModelCompatibilityToast() {
    if (!modelCompatibilityNotice) return null;
    return h(
      "div",
      {
        role: "status",
        "aria-live": "polite",
        className: cn(
          "fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-[#DDE0E4]",
          "bg-white px-3.5 py-3 text-xs leading-5 text-ink",
          "shadow-[0_12px_30px_rgba(21,23,26,.14)]",
        ),
      },
      modelCompatibilityNotice.message,
    );
  }

  // TEMPORARY (dev-only): quick jumps between onboarding stages so the UI can
  // be iterated on without retyping material or waiting through the full flow
  // each time. Remove once onboarding is settled.
  function renderDevStageNav() {
    if (process.env.NODE_ENV === "production") return null;
    const sampleSource = () =>
      sources.length ? sources : [createNotesSource("A reusable water bottle with a built-in filter.")];
    return h(
      "div",
      {
        className:
          "fixed left-1/2 top-2 z-[300] flex -translate-x-1/2 items-center gap-1 rounded-full " +
          "border border-[#DDE0E4] bg-white/95 px-2 py-1 text-[10px] font-semibold text-muted " +
          "shadow-[0_6px_16px_rgba(21,23,26,.16)] backdrop-blur",
        "aria-label": "Dev: jump to onboarding stage",
      },
      h("span", { className: "mono px-1 uppercase tracking-wider text-muted/70" }, "Dev"),
      onDevPreviewSignIn
        ? h(
            "button",
            {
              type: "button",
              className: "rounded-full px-2 py-1 hover:bg-canvas hover:text-ink",
              onClick: onDevPreviewSignIn,
            },
            "0 Sign in",
          )
        : null,
      h(
        "button",
        {
          type: "button",
          className: "rounded-full px-2 py-1 hover:bg-canvas hover:text-ink",
          onClick: () => {
            setBuildRequest(null);
            setProductContextFlow("intake");
            setWorkbenchStage("material");
            setDevStartAtExtras(false);
          },
        },
        "1 Material",
      ),
      h(
        "button",
        {
          type: "button",
          className: "rounded-full px-2 py-1 hover:bg-canvas hover:text-ink",
          onClick: () => {
            setBuildRequest(null);
            setProductContextFlow("intake");
            setSources(sampleSource());
            setWorkbenchStage("package");
            setDevStartAtExtras(false);
          },
        },
        "2 Package",
      ),
      h(
        "button",
        {
          type: "button",
          className: "rounded-full px-2 py-1 hover:bg-canvas hover:text-ink",
          onClick: () => {
            const seeded = sampleSource();
            setSources(seeded);
            setDevStartAtExtras(false);
            startBuild(seeded);
          },
        },
        "3 Review (runs a real build)",
      ),
      h(
        "button",
        {
          type: "button",
          className: "rounded-full px-2 py-1 hover:bg-canvas hover:text-ink",
          onClick: () => {
            const seeded = sampleSource();
            setSources(seeded);
            setDevStartAtExtras(true);
            startBuild(seeded);
          },
        },
        "4 Testing & integrations",
      ),
    );
  }

  function handleIncompatibleModelAttempt(provider: AiProvider, model: string) {
    const issues = productContextCompatibilityIssues(provider, model, sources);
    if (!issues.length) return;
    setModelCompatibilityNotice({
      message: productContextIncompatibilityMessage(provider, model, sources),
    });
  }

  // Add a product URL as a normalized source.
  async function handleUrl() {
    if (!url.trim() || urlLoading) return;

    setUrlLoading(true);

    try {
      const source = await addProductUrl(url.trim());
      setSources((current) => [...current, source]);
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add that product page.");
    } finally {
      setUrlLoading(false);
    }
  }

  // Convert browser assets into the evidence payloads consumed by product synthesis.
  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setMaterialLoading(true);
    setError(null);

    try {
      const expanded = await Promise.all(
        Array.from(fileList).map((file) => (isZipFile(file) ? unzipFile(file) : [file])),
      );
      const flatFiles = expanded.flat();
      if (!flatFiles.length) {
        throw new Error("No usable files were found in that archive.");
      }

      const next = await Promise.all(
        flatFiles.map(async (file): Promise<ProductSource> => {
          const mimeType = file.type || "application/octet-stream";
          const isImage = mimeType.startsWith("image/");
          const isVideo = mimeType.startsWith("video/");
          const maxBytes = isVideo ? maxVideoBytes : isImage ? maxImageBytes : maxDocumentBytes;
          if (file.size > maxBytes) {
            throw new Error(
              `${file.name} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB intake limit.`,
            );
          }

          if (isVideo) {
            const frames = await extractVideoFrames(file);
            return {
              id: crypto.randomUUID(),
              type: "video",
              label: "Product video",
              filename: file.name,
              mimeType,
              size: file.size,
              value: JSON.stringify({ version: 1, kind: "video_frames", frames }),
              previewUrl: frames[0],
              status: "ready",
            };
          }

          const dataUrl = await readAsDataUrl(file);
          if (isImage) {
            const previewUrl = URL.createObjectURL(file);
            previewUrls.current.add(previewUrl);
            return {
              id: crypto.randomUUID(),
              type: "image",
              label: "Product image",
              filename: file.name,
              mimeType,
              size: file.size,
              value: JSON.stringify({ version: 1, kind: "image", dataUrl }),
              previewUrl,
              status: "ready",
            };
          }

          const base64 = dataUrl.split(",", 2)[1];
          if (!base64) throw new Error(`Could not prepare ${file.name} for synthesis.`);
          return {
            id: crypto.randomUUID(),
            type: "file",
            label: "Product document",
            filename: file.name,
            mimeType,
            size: file.size,
            value: JSON.stringify({ version: 1, kind: "document", data: base64 }),
            status: "ready",
          };
        }),
      );
      setSources((current) => [...current, ...next]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare that product material.");
    } finally {
      setMaterialLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function createNotesSource(value: string): ProductSource {
    return {
      id: crypto.randomUUID(),
      type: "text",
      label: "Product notes",
      value,
      status: "ready",
    };
  }

  // Commit draft notes as a text source.
  function handleDescription() {
    if (!hasDraftNotes) return;

    setSources((current) => [...current, createNotesSource(description.trim())]);
    setDescription("");
  }

  async function addFromGoogleDrive() {
    setGoogleDriveLoading(true);
    setError(null);
    try {
      const picked = await openGoogleDrivePicker("import");
      if (!picked) return;
      const source = await api.importGoogleDriveFile({ fileId: picked.fileId });
      setSources((current) => [...current, source]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import that file from Google Drive.");
    } finally {
      setGoogleDriveLoading(false);
    }
  }

  function removeSource(source: ProductSource) {
    if (source.previewUrl) {
      URL.revokeObjectURL(source.previewUrl);
      previewUrls.current.delete(source.previewUrl);
    }

    setSources((current) => current.filter((item) => item.id !== source.id));
  }

  // Drag depth avoids flickering when the cursor moves across nested drop targets.
  function onDragEnter(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current -= 1;

    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    void addFiles(event.dataTransfer.files);
  }

  // Hand committed material to the post-click build lifecycle.
  function startBuild(sourceList: ProductSource[]) {
    setBuildRequest({
      sources: sourceList,
      ai: { provider: aiProvider, model: aiModel },
      simulateError,
    });
    setProductContextFlow("building");
  }

  /** Breadcrumb checkpoint navigation: only Material/Package are ever jump targets. */
  function goToCheckpoint(target: "material" | "package") {
    setBuildRequest(null);
    setProductContextFlow("intake");
    setWorkbenchStage(target);
  }

  function processSources() {
    if (!sources.length && !hasDrafts) return;

    if (hasDrafts) {
      setDraftConfirmation(true);
      return;
    }

    setWorkbenchStage("package");
  }

  function ignoreDraftsAndProcess() {
    setDraftConfirmation(false);

    if (sources.length) {
      setWorkbenchStage("package");
    }
  }

  async function submitDraftsAndProcess() {
    const draftUrl = url.trim();
    const draftNotes = description.trim();
    let nextSources = [...sources];

    setDraftConfirmation(false);

    try {
      if (draftUrl) {
        setUrlLoading(true);
        const source = await addProductUrl(draftUrl);
        nextSources = [...nextSources, source];
        setUrl("");
      }

      if (draftNotes) {
        nextSources = [...nextSources, createNotesSource(draftNotes)];
        setDescription("");
      }

      setSources(nextSources);

      if (nextSources.length) setWorkbenchStage("package");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add the draft product material.",
      );
    } finally {
      setUrlLoading(false);
    }
  }

  if (buildRequest && productContextFlow !== "intake") {
    const stage: ProductWorkbenchStage = productContextFlow === "ready" ? "review" : "build";
    return h(
      ProductWorkbench,
      { stage, onNavigateBack: goToCheckpoint },
      h(BuildContext, {
        ...buildRequest,
        onBackToIntake: () => {
          setBuildRequest(null);
          setProductContextFlow("intake");
          setWorkbenchStage("material");
        },
        onFlowStateChange: setProductContextFlow,
        devStartAtExtras,
      }),
      renderDevStageNav(),
    );
  }

  if (workbenchStage === "package") {
    return h(
      ProductWorkbench,
      { stage: "package", onNavigateBack: goToCheckpoint },
      h(
        "section",
        {
          className: "mx-auto max-w-lg py-6",
          "aria-labelledby": "package-title",
        },
        h(
          "div",
          { className: "text-center" },
          h(
            "p",
            { className: "mono text-[10px] font-semibold uppercase tracking-[.16em] text-muted" },
            "What you gave us",
          ),
          h(
            "h1",
            {
              id: "package-title",
              className: "mt-2 text-3xl font-semibold tracking-[-.04em]",
            },
            "Ready to build context?",
          ),
          h(
            "p",
            { className: "mx-auto mt-2 max-w-sm text-sm leading-6 text-muted" },
            "We'll turn this into a structured product profile Prism can reason about.",
          ),
        ),
        h(
          "ul",
          {
            className:
              "mt-7 space-y-2.5 rounded-xl border border-border-default bg-panel p-4 text-sm text-ink",
            "aria-label": "Included material",
          },
          ...sources.map((source) =>
            h(
              "li",
              { key: source.id, className: "flex items-center gap-2.5" },
              h(CheckCircle2, { size: 15, className: "shrink-0 text-lineage" }),
              h("span", { className: "truncate" }, sourceDisplayName(source)),
            ),
          ),
        ),
        h(
          "div",
          { className: "mt-7" },
          h(GenerationControl, {
            provider: aiProvider,
            model: aiModel,
            sources,
            title: "Generation model",
            description: "Choose the model for this product package.",
            actionLabel: "Build product context",
            actionClassName: "onboarding-confirm-button",
            operation: "product_context_building",
            disabled: !sources.length,
            onGenerate: () => startBuild(sources),
            onProviderChange: (nextProvider: AiProvider) => {
              const fallback = leastExpensiveCompatibleModel(sources, nextProvider);
              const compatible =
                fallback?.provider === nextProvider
                  ? fallback.model
                  : firstCompatibleModel(nextProvider, sources);
              if (!compatible) {
                handleIncompatibleModelAttempt(
                  nextProvider,
                  AI_MODEL_OPTIONS[nextProvider][0]?.id ?? "",
                );
                return;
              }
              setAiProvider(nextProvider);
              setAiModel(compatible);
            },
            onModelChange: setAiModel,
            onIncompatibleModelAttempt: handleIncompatibleModelAttempt,
          }),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: () => setWorkbenchStage("material"),
            className: "mt-4 w-full text-center text-xs font-semibold text-muted hover:text-ink",
          },
          "Edit material",
        ),
      ),
      renderToast(),
      renderModelCompatibilityToast(),
      renderDevStageNav(),
    );
  }

  return h(
    ProductWorkbench,
    { stage: "material", onNavigateBack: goToCheckpoint },
    renderToast(),
    renderModelCompatibilityToast(),
    h(MaterialIntake, {
      sources,
      url,
      notes: description,
      error,
      urlLoading,
      materialLoading,
      dragActive,
      fileInput,
      onUrlChange: setUrl,
      onUrlSubmit: () => void handleUrl(),
      onNotesChange: setDescription,
      onAddNotes: handleDescription,
      onRemoveSource: removeSource,
      onContinue: processSources,
      onFiles: (files) => void addFiles(files),
      onDragEnter,
      onDragLeave,
      onDrop,
      onAddFromGoogleDrive: () => void addFromGoogleDrive(),
      googleDriveLoading,
    }),
    renderDevStageNav(),
  );

  // Source cards summarize every piece of material currently included in the build.
  const sourceCards = sources.map((source) => {
    const resultSummary = sourceResultSummary(source);
    return h(
      "li",
      {
        key: source.id,
        className: cn(
          "relative rounded-lg border border-[#DDE0E4] bg-white p-3.5",
          "shadow-sm",
          source.inspection?.fetch.status === UrlFetchStatus.Unreachable ? "border-[#F4C7C3]" : "",
        ),
      },
      h(
        "button",
        {
          type: "button",
          onClick: () => removeSource(source),
          className: cn(
            "absolute right-2 top-2 rounded p-1.5 text-muted",
            "hover:bg-canvas hover:text-ink",
          ),
          "aria-label": `Remove ${source.filename ?? source.label}`,
        },
        h(Trash2, { size: 13 }),
      ),
      h(
        "div",
        { className: "flex items-center gap-2" },
        h(
          "span",
          {
            className: cn("grid h-7 w-7 place-items-center rounded-md bg-canvas", "text-lineage"),
          },
          sourceIcon(source.type),
        ),
        h(
          "span",
          {
            className: cn("mono text-[8px] font-semibold uppercase tracking-[.13em]", "text-muted"),
          },
          sourceMeta[source.type].label,
        ),
      ),
      source.previewUrl
        ? h("img", {
            src: source.previewUrl,
            alt: source.filename ?? "Product preview",
            className: "mt-3 h-20 w-full rounded-md object-cover",
          })
        : null,
      h("p", { className: "mt-3 truncate pr-5 text-xs font-semibold" }, sourceDisplayName(source)),
      h(
        "p",
        { className: "mono mt-1 truncate text-[9px] text-muted" },
        source.type === "url"
          ? source.value
          : source.type === "text"
            ? "Notes added"
            : `${formatSize(source.size)} \u00B7 ${
                source.mimeType?.split("/")[1]?.toUpperCase() ?? "FILE"
              }`,
      ),
      h(
        "div",
        {
          className: cn(
            "mt-3 flex items-center gap-1.5 font-mono text-[8px]",
            "font-semibold uppercase tracking-wider",
            resultSummary.className,
          ),
        },
        resultSummary.complete
          ? h(CheckCircle2, { size: 11 })
          : h("span", { className: "h-1.5 w-1.5 rounded-full bg-current" }),
        resultSummary.label,
      ),
    );
  });

  // The default view collects product material before context is generated.
  return h(
    ProductWorkbench,
    { stage: "material" },
    renderToast(),
    renderModelCompatibilityToast(),
    h(
      "div",
      { className: "w-full" },
      h(
        "section",
        {
          className: cn(
            "relative overflow-hidden rounded-2xl border-2 bg-white px-5 py-6",
            "shadow-[0_12px_38px_rgba(21,23,26,.07)] transition-colors",
            "sm:px-9 sm:py-8",
            dragActive ? "border-lineage bg-[#F5F8FF]" : "border-[#C8CDD4]",
          ),
          onDragEnter,
          onDragOver: (event: React.DragEvent) => event.preventDefault(),
          onDragLeave,
          onDrop,
          "aria-label": "Product material intake dock",
        },
        dragActive
          ? h(
              "div",
              {
                className: cn(
                  "pointer-events-none absolute inset-3 z-20 grid place-items-center",
                  "rounded-xl border-2 border-lineage bg-[#EAF1FF]/90 text-center",
                ),
              },
              h(
                "div",
                null,
                h(
                  "div",
                  {
                    className: cn(
                      "mx-auto grid h-16 w-16 place-items-center rounded-full",
                      "bg-lineage text-white",
                    ),
                  },
                  h(UploadCloud, { size: 28 }),
                ),
                h(
                  "p",
                  { className: "mt-4 text-sm font-semibold text-lineage" },
                  "DROP TO ADD PRODUCT MATERIAL",
                ),
                h(
                  "p",
                  { className: "mt-1 text-xs text-muted" },
                  "Files, images, screenshots, decks and PDFs are welcome.",
                ),
              ),
            )
          : null,
        h(
          "div",
          { className: "relative z-10" },
          h(
            "div",
            { className: "mb-8 grid gap-3 sm:grid-cols-2 sm:items-end sm:gap-8" },
            h(
              "h1",
              { className: "text-3xl font-semibold tracking-[-.04em] sm:text-4xl" },
              "Bring the product.",
            ),
            h(
              "p",
              {
                className:
                  "max-w-lg text-sm leading-6 text-muted sm:justify-self-end sm:text-right",
              },
              "Paste a URL, drop files or images, or describe what you're selling.",
            ),
          ),
          h(
            "div",
            { className: "flex items-start justify-between gap-4" },
            h(
              "div",
              null,
              h(
                "p",
                {
                  className: cn(
                    "mono text-[10px] font-semibold uppercase tracking-[.17em]",
                    "text-ink",
                  ),
                },
                "Drop product material here",
              ),
              h(
                "p",
                { className: "mt-2 max-w-xl text-sm leading-6 text-muted" },
                "URLs, documents, images, videos, screenshots, notes",
                " — anything useful.",
              ),
            ),
            h(
              "div",
              { className: "flex shrink-0 items-center gap-3" },
              h(
                "p",
                {
                  className:
                    "mono text-right text-[9px] font-semibold uppercase tracking-[.18em] text-lineage",
                },
                "URL · File · Image · Text",
              ),
              h(
                "div",
                {
                  className: cn(
                    "hidden h-10 w-10 place-items-center rounded-full bg-canvas",
                    "text-lineage sm:grid",
                  ),
                },
                h(UploadCloud, { size: 18 }),
              ),
            ),
          ),
          sources.length
            ? h(
                "div",
                { className: "mt-7 border-y border-[#ECEEF1] py-5" },
                h(
                  "div",
                  { className: "flex items-center justify-between" },
                  h(
                    "p",
                    {
                      className: cn(
                        "mono text-[9px] font-semibold uppercase tracking-[.15em]",
                        "text-muted",
                      ),
                    },
                    `Product material · ${sources.length} source`,
                    sources.length === 1 ? "" : "s",
                  ),
                  h("span", { className: "text-[10px] text-muted" }, "Everything currently known"),
                ),
                h(
                  "ul",
                  { className: "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" },
                  ...sourceCards,
                ),
              )
            : null,
          h(
            "form",
            {
              className: sources.length ? "mt-6" : "mt-9",
              onSubmit: (event: React.FormEvent) => {
                event.preventDefault();
                void handleUrl();
              },
            },
            h(
              "label",
              { htmlFor: "product-url", className: "sr-only" },
              "Paste a product page or store URL",
            ),
            h(
              "div",
              { className: "flex items-stretch gap-2" },
              h(
                "div",
                { className: "relative min-w-0 flex-1" },
                h(Link2, {
                  size: 19,
                  className: "absolute left-4 top-1/2 -translate-y-1/2 text-lineage",
                }),
                h("input", {
                  id: "product-url",
                  value: url,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    setUrl(event.target.value);
                  },
                  placeholder: "Paste a product page or store URL",
                  className: cn(
                    "h-12 w-full rounded-lg border border-[#BFC5CD] bg-white",
                    "pl-12 pr-4 text-base shadow-sm placeholder:text-[#9CA1A9]",
                    "focus:border-lineage sm:text-lg",
                  ),
                }),
              ),
              h(
                "button",
                {
                  type: "submit",
                  disabled: !url.trim() || urlLoading,
                  className: cn(
                    "relative grid h-12 w-12 shrink-0 place-items-center",
                    "rounded-md bg-ink text-white hover:bg-lineage disabled:opacity-30",
                  ),
                  "aria-label": "Add product URL",
                },
                urlLoading
                  ? h(LoaderCircle, {
                      size: 17,
                      className: "animate-spin motion-reduce:animate-none",
                    })
                  : h(ArrowRight, { size: 18 }),
                hasDraftUrl
                  ? h("span", {
                      className: cn(
                        "absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime",
                        "ring-2 ring-ink",
                      ),
                      "aria-hidden": true,
                    })
                  : null,
              ),
            ),
          ),
          h(
            "button",
            {
              type: "button",
              disabled: materialLoading,
              onClick: () => fileInput.current?.click(),
              className: cn(
                "mt-4 flex h-32 w-full flex-col items-center justify-center rounded-lg",
                "border border-dashed border-[#BFC5CD] bg-[#FAFBFC] text-center",
                "hover:border-lineage hover:bg-[#F5F8FF] focus-visible:border-lineage",
                "disabled:cursor-wait disabled:opacity-60",
              ),
            },
            materialLoading
              ? h(LoaderCircle, {
                  size: 24,
                  className: "animate-spin motion-reduce:animate-none text-lineage",
                })
              : h(UploadCloud, { size: 24, className: "text-lineage" }),
            h(
              "span",
              { className: "mt-3 text-xs font-semibold" },
              materialLoading ? "Preparing product material" : "Drop product material",
            ),
            h(
              "span",
              { className: cn("mono mt-1 text-[9px] uppercase tracking-wider", "text-muted") },
              "Document · image · video · zip · or browse",
            ),
          ),
          h("input", {
            ref: fileInput,
            type: "file",
            multiple: true,
            accept: ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,image/*,video/*",
            className: "sr-only",
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              void addFiles(event.target.files);
            },
          }),
          error ? h("p", { className: "mt-3 text-xs text-[#B42318]", role: "alert" }, error) : null,
          h(
            "div",
            {
              className: cn(
                "mt-8 grid w-full gap-8 border-y border-[#ECEEF1] py-6",
                "lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start",
              ),
            },
            h(
              "div",
              {
                className: cn(
                  "min-w-0 w-full [&>label>textarea]:h-40",
                  "[&>label>textarea]:min-h-[150px] [&>label>textarea]:max-h-44",
                ),
              },
              h(
                "label",
                { htmlFor: "product-notes", className: "block" },
                h(
                  "span",
                  { className: "text-xs font-semibold" },
                  "Add notes",
                  h(
                    "span",
                    { className: "ml-2 text-xs text-muted" },
                    "Anything the source material doesn't explain.",
                  ),
                ),
                h("textarea", {
                  id: "product-notes",
                  value: description,
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setDescription(event.target.value);
                  },
                  rows: 3,
                  placeholder: "Describe anything useful about the product…",
                  className: cn(
                    "mt-2 w-full resize-y rounded-lg border border-[#BFC5CD] bg-white",
                    "p-4 text-sm leading-6 placeholder:text-[#9CA1A9]",
                  ),
                }),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: !description.trim(),
                    onClick: handleDescription,
                    className: cn(
                      "relative mt-2 flex items-center gap-1.5 text-xs font-semibold",
                      "text-lineage hover:text-ink disabled:opacity-30",
                    ),
                  },
                  h(Plus, { size: 14 }),
                  "Add these notes to the material",
                  hasDraftNotes
                    ? h("span", {
                        className: cn(
                          "absolute -right-2 -top-1 h-2 w-2 rounded-full bg-lime",
                          "ring-2 ring-white",
                        ),
                        "aria-hidden": true,
                      })
                    : null,
                ),
              ),
            ),
            h(
              "div",
              { className: "min-w-0 w-full" },
              h(
                "p",
                { className: "text-xs font-semibold text-ink" },
                `${sources.length} source${sources.length === 1 ? "" : "s"} ready`,
              ),
              h(
                "p",
                { className: "mt-1 text-xs leading-5 text-muted" },
                "Inspect the package before Prism builds product context.",
              ),
              h(
                "button",
                {
                  type: "button",
                  disabled: !sources.length && !hasDrafts,
                  onClick: processSources,
                  className:
                    "mt-4 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-lineage disabled:opacity-35",
                },
                "Check sources",
                h(ArrowRight, { size: 14 }),
              ),
            ),
          ),
        ),
        h(
          "div",
          {
            className: cn(
              "mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t",
              "border-[#ECEEF1] pt-4 text-[10px] text-muted",
            ),
          },
          h(
            "span",
            {
              className: cn("mono font-semibold uppercase tracking-[.14em]"),
            },
            "What happens next",
          ),
          h("span", null, "Product context"),
          h("span", { className: "text-lineage" }, "→"),
          h("span", null, "Audiences"),
          h("span", { className: "text-lineage" }, "→"),
          h("span", null, "Angles"),
          h("span", { className: "text-lineage" }, "→"),
          h("span", null, "Creative types"),
          h("span", { className: "text-lineage" }, "→"),
          h("span", null, "Executions"),
          h("span", { className: "text-lineage" }, "→"),
          h("span", null, "Creatives"),
        ),
        process.env.NODE_ENV !== "production"
          ? h(
              "details",
              { className: "mt-5 text-[9px] text-muted" },
              h("summary", { className: "cursor-pointer" }, "Diagnostics"),
              h(
                "label",
                { className: "mt-2 inline-flex items-center gap-2" },
                h("input", {
                  type: "checkbox",
                  checked: simulateError,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    setSimulateError(event.target.checked);
                  },
                }),
                "Simulate processing error",
              ),
            )
          : null,
      ),
    ),
  );
}
