import { apiClient } from "../services/apiClient";

export async function openAuthenticatedFile(url: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
