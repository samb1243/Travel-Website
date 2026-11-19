import { describe, expect, it } from "vitest";
import { cleanDocumentName, detectDocumentKind, formatFileSize } from "./documents";

const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("detectDocumentKind", () => {
  it("knows PDFs and photos by their first bytes", () => {
    expect(detectDocumentKind(bytes("%PDF-1.7\n..."))).toBe("pdf");
    expect(detectDocumentKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image");
    expect(detectDocumentKind(new Uint8Array([0x89, ...bytes("PNG\r\n")]))).toBe("image");
    expect(detectDocumentKind(bytes("RIFF....WEBPVP8 "))).toBe("image");
    expect(detectDocumentKind(bytes("....ftypheic"))).toBe("image");
  });

  it("refuses anything else, whatever it's called", () => {
    expect(detectDocumentKind(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectDocumentKind(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(detectDocumentKind(bytes("PK\u0003\u0004 a zip or docx"))).toBeNull();
    expect(detectDocumentKind(new Uint8Array())).toBeNull();
  });
});

describe("cleanDocumentName", () => {
  it("keeps a readable name with the right extension", () => {
    expect(cleanDocumentName("Boarding pass TG917.PDF", "pdf")).toBe("Boarding pass TG917.pdf");
    expect(cleanDocumentName("IMG_2041.HEIC", "image")).toBe("IMG_2041.webp");
  });

  it("drops folders, control characters and quotes", () => {
    expect(cleanDocumentName("C:\\Users\\me\\..\\visa\".pdf", "pdf")).toBe("visa.pdf");
    expect(cleanDocumentName("../../etc/passwd", "pdf")).toBe("passwd.pdf");
    expect(cleanDocumentName("a\u0000b\nc.pdf", "pdf")).toBe("abc.pdf");
    expect(cleanDocumentName("", "image")).toBe("Photo.webp");
    expect(cleanDocumentName("x".repeat(300), "pdf")).toHaveLength(100);
  });
});

describe("formatFileSize", () => {
  it("reads naturally", () => {
    expect(formatFileSize(340_000)).toBe("340 KB");
    expect(formatFileSize(1_240_000)).toBe("1.2 MB");
    expect(formatFileSize(10)).toBe("1 KB");
  });
});
