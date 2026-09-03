import httpClient from "@/services/httpClient";
import { apiRequest } from "@/services/apiRequest";

export async function fetchDocumentDevHealth() {
  return apiRequest({ url: "/document-dev/health" });
}

export async function fetchDocumentTemplates() {
  const data = await apiRequest({ url: "/document-dev/templates" });
  return data?.templates ?? [];
}

export async function fetchDocumentTemplateFields(templateId) {
  return apiRequest({ url: `/document-dev/templates/${templateId}/fields` });
}

export async function uploadDocumentTemplate({ file, name, version }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("name", name);
  fd.append("version", version);
  const data = await apiRequest({ url: "/document-dev/templates", method: "post", data: fd });
  return data?.template ?? data;
}

export async function seedDemoDocumentForTemplate(templateId) {
  const data = await apiRequest({
    url: `/document-dev/demo-documents/template/${templateId}`,
    method: "post",
  });
  return data?.document ?? data;
}

export async function seedBienBanTestV2DemoDocument() {
  const data = await apiRequest({
    url: "/document-dev/demo-documents/bien-ban-test-v2",
    method: "post",
  });
  return data?.document ?? data;
}

export async function fetchDocumentById(documentId) {
  const data = await apiRequest({ url: `/document-dev/documents/${documentId}` });
  return data?.document ?? data;
}

export async function renderStoredDocumentPdfBlob(documentId, body = {}) {
  const res = await httpClient.post(
    `/document-dev/documents/${documentId}/pdf`,
    {
      signatures: body.signatures ?? {},
      signature_dates: body.signature_dates ?? {},
      ...(body.signature_block ? { signature_block: body.signature_block } : {}),
    },
    { responseType: "blob" },
  );
  return res.data;
}
