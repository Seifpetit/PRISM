"use client";

import {
  Fragment,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  HardDrive,
  Image,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { h } from "@/lib/h";
import type { ProductSource, ProductSourceType } from "@/types/strategy";

type MaterialIntakeProps = {
  sources: ProductSource[];
  url: string;
  notes: string;
  error: string | null;
  urlLoading: boolean;
  materialLoading: boolean;
  dragActive: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  onUrlChange: (value: string) => void;
  onUrlSubmit: () => void;
  onNotesChange: (value: string) => void;
  onAddNotes: () => void;
  onRemoveSource: (source: ProductSource) => void;
  onContinue: () => void;
  onFiles: (files: FileList | null) => void;
  onDragEnter: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onAddFromGoogleDrive: () => void;
  googleDriveLoading: boolean;
};

const sourceIcons = {
  url: Link2,
  file: FileText,
  image: Image,
  video: Video,
  text: FileText,
};

const fileSourceTypes: ProductSourceType[] = ["file", "image", "video"];

type StepId = 0 | 1 | 2;

const STEPS: Array<{ id: StepId; label: string; prompt: string; sourceTypes: ProductSourceType[] }> = [
  { id: 0, label: "Link", prompt: "Do you have a link to the product?", sourceTypes: ["url"] },
  { id: 1, label: "Files", prompt: "Any files, images, or video?", sourceTypes: fileSourceTypes },
  { id: 2, label: "Notes", prompt: "Anything else worth noting?", sourceTypes: ["text"] },
];

function sourceName(source: ProductSource) {
  if (source.filename) return source.filename;
  if (source.type === "text") return "Product notes";
  return source.value ?? source.label;
}

function Hint({ icon, children }: { icon: typeof Link2; children?: ReactNode }) {
  return h(
    "li",
    { className: "material-hint-row" },
    h(icon, {
      size: 38,
      className: icon === Sparkles ? "material-ai-star" : undefined,
      "aria-hidden": true,
    }),
    h("span", null, children),
  );
}

export function MaterialIntake(props: MaterialIntakeProps) {
  const [step, setStep] = useState<StepId>(0);
  const hasDraftNotes = Boolean(props.notes.trim());
  const hasDraftUrl = Boolean(props.url.trim());
  const canFinish = props.sources.length > 0 || hasDraftUrl || hasDraftNotes;
  const isLastStep = step === 2;

  function stepHasMaterial(id: StepId) {
    return props.sources.some((source) => STEPS[id].sourceTypes.includes(source.type));
  }

  function handlePrimary() {
    if (isLastStep) {
      // EmptyProduct's onContinue already detects an unsubmitted URL/notes draft
      // and prompts to submit-or-ignore before advancing — let it own that, rather
      // than adding the note here too and racing its stale-closure read of it.
      props.onContinue();
      return;
    }
    setStep((current) => (current + 1) as StepId);
  }

  const stepper = h(
    "div",
    { className: "material-stepper", role: "tablist", "aria-label": "Material intake steps" },
    ...STEPS.map((meta, index) => {
      const done = stepHasMaterial(meta.id);
      const current = step === meta.id;
      return h(
        "button",
        {
          key: meta.id,
          type: "button",
          role: "tab",
          "aria-selected": current,
          className: `material-step-pill ${current ? "is-current" : ""} ${done ? "is-done" : ""}`,
          onClick: () => setStep(meta.id),
        },
        h(
          "span",
          { className: "material-step-index", "aria-hidden": true },
          done ? h(Check, { size: 11 }) : index + 1,
        ),
        meta.label,
      );
    }),
  );

  const linkStep = h(
    "form",
    {
      className: "material-url-form",
      onSubmit: (event: React.FormEvent) => {
        event.preventDefault();
        props.onUrlSubmit();
      },
    },
    h(Link2, { size: 19, "aria-hidden": true }),
    h("label", { htmlFor: "material-product-url", className: "sr-only" }, "Product URL"),
    h("input", {
      id: "material-product-url",
      value: props.url,
      autoFocus: true,
      onChange: (event: ChangeEvent<HTMLInputElement>) => props.onUrlChange(event.target.value),
      placeholder: "Paste a product page or any URL",
    }),
    h(
      "button",
      {
        type: "submit",
        className: "material-prism-button",
        disabled: !hasDraftUrl || props.urlLoading,
        "aria-label": "Add product URL",
      },
      props.urlLoading
        ? h(LoaderCircle, { size: 19, className: "animate-spin", "aria-hidden": true })
        : h(ArrowRight, { size: 21, "aria-hidden": true }),
    ),
  );

  const filesStep = h(
    Fragment,
    null,
    h(
      "button",
      {
        type: "button",
        className: "material-drop-zone",
        disabled: props.materialLoading,
        onClick: () => props.fileInput.current?.click(),
      },
      props.materialLoading
        ? h(LoaderCircle, { size: 34, className: "animate-spin", "aria-hidden": true })
        : h(UploadCloud, { size: 36, "aria-hidden": true }),
      h(
        "strong",
        null,
        props.materialLoading ? "Preparing product material" : "Drop files or images here",
      ),
      h("span", null, "PDF, DOCX, TXT, PNG, JPG, MP4, MOV, ZIP and more."),
    ),
    h("input", {
      ref: props.fileInput,
      type: "file",
      multiple: true,
      accept: ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,image/*,video/*",
      className: "sr-only",
      onChange: (event: ChangeEvent<HTMLInputElement>) => props.onFiles(event.target.files),
    }),
    h(
      "button",
      {
        type: "button",
        className: "material-drive-button",
        disabled: props.materialLoading || props.googleDriveLoading,
        onClick: props.onAddFromGoogleDrive,
      },
      props.googleDriveLoading
        ? h(LoaderCircle, { size: 16, className: "animate-spin", "aria-hidden": true })
        : h(HardDrive, { size: 16, "aria-hidden": true }),
      "Add from Google Drive",
    ),
  );

  const notesStep = h(
    "div",
    { className: "material-notes is-open" },
    h(
      "div",
      { className: "material-notes-body" },
      h("label", { htmlFor: "material-notes-text", className: "sr-only" }, "Notes"),
      h("textarea", {
        id: "material-notes-text",
        autoFocus: true,
        value: props.notes,
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => props.onNotesChange(event.target.value),
        placeholder: "Anything that helps us understand the product…",
        rows: 4,
      }),
      h(
        "button",
        {
          type: "button",
          disabled: !hasDraftNotes,
          onClick: props.onAddNotes,
        },
        "Add this note",
      ),
    ),
  );

  const stepBody = step === 0 ? linkStep : step === 1 ? filesStep : notesStep;

  return h(
    "section",
    {
      className: `material-intake ${props.dragActive ? "is-dragging" : ""}`,
      onDragEnter: props.onDragEnter,
      onDragOver: (event: DragEvent) => event.preventDefault(),
      onDragLeave: props.onDragLeave,
      onDrop: props.onDrop,
      "aria-labelledby": "material-title",
    },
    props.dragActive
      ? h(
          "div",
          { className: "material-drop-overlay" },
          h(UploadCloud, { size: 30, "aria-hidden": true }),
          h("strong", null, "Drop files or images here"),
        )
      : null,
    h(
      "div",
      { className: "material-main" },
      h(
        "div",
        { className: "material-heading" },
        h(
          "h1",
          { id: "material-title" },
          "Bring the product in.",
          h("img", {
            src: "/landing/assets/logo.png",
            alt: "",
            "aria-hidden": true,
          }),
        ),
      ),
      stepper,
      h("p", { className: "material-step-prompt" }, STEPS[step].prompt),
      stepBody,
      props.sources.length
        ? h(
            "ul",
            { className: "material-source-list", "aria-label": "Included material" },
            ...props.sources.map((source) => {
              const Icon = sourceIcons[source.type];
              return h(
                "li",
                { key: source.id },
                h(Icon, { size: 16, "aria-hidden": true }),
                h("span", null, sourceName(source)),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => props.onRemoveSource(source),
                    "aria-label": `Remove ${sourceName(source)}`,
                  },
                  h(Trash2, { size: 14, "aria-hidden": true }),
                ),
              );
            }),
          )
        : null,
      props.error ? h("p", { className: "material-error", role: "alert" }, props.error) : null,
      h(
        "div",
        { className: "material-step-nav" },
        step > 0
          ? h(
              "button",
              {
                type: "button",
                className: "material-step-back",
                onClick: () => setStep((current) => (current - 1) as StepId),
              },
              h(ArrowLeft, { size: 15, "aria-hidden": true }),
              "Back",
            )
          : h("span", null),
        h(
          "button",
          {
            type: "button",
            className: "material-prism-button material-step-primary",
            disabled: isLastStep && !canFinish,
            onClick: handlePrimary,
            title: isLastStep && !canFinish ? "Add at least a link, file, or note first" : undefined,
          },
          isLastStep ? "Continue" : "Next",
          h(ArrowRight, { size: 17, "aria-hidden": true }),
        ),
      ),
      isLastStep && !canFinish
        ? h(
            "p",
            { className: "material-step-hint", role: "status" },
            "Add at least a link, file, or note before continuing.",
          )
        : null,
    ),
    h(
      "aside",
      { className: "material-hints", "aria-label": "Why good material matters" },
      h("img", {
        src: "/landing/assets/logo.png",
        alt: "Prism crystal",
        className: "material-hint-crystal",
      }),
      h(
        "ul",
        null,
        h(
          Hint,
          { icon: Sparkles },
          "Good material builds ",
          h("em", null, "better context."),
        ),
        h(Hint, { icon: Link2 }, "More source material means better angles."),
        h(Hint, { icon: ShieldCheck }, "We only use what’s relevant and never share it."),
        h(Hint, { icon: LockKeyhole }, "All data is private and encrypted."),
      ),
    ),
  );
}
