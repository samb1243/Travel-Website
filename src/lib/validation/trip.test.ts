import { describe, expect, it } from "vitest";
import { tripSchema } from "./trip";

const base = {
  title: "  Tour du Mont Blanc ",
  type: "HIKING",
  startDate: "2027-07-03",
  endDate: "2027-07-13",
  currency: "EUR",
  budget: "1,500.50",
  travellers: "2",
  description: "",
  coverImageUrl: "",
};

describe("tripSchema", () => {
  it("cleans up valid input", () => {
    const r = tripSchema.parse(base);
    expect(r.title).toBe("Tour du Mont Blanc");
    expect(r.budget).toBe(1500.5);
    expect(r.travellers).toBe(2);
    expect(r.description).toBeNull();
    expect(r.coverImageUrl).toBeNull();
    expect(r.startDate?.toISOString()).toBe("2027-07-03T00:00:00.000Z");
  });

  it("allows a trip with no dates yet", () => {
    expect(tripSchema.safeParse({ ...base, startDate: "", endDate: "" }).success).toBe(true);
  });

  it.each([
    [{ endDate: "2027-07-01" }, "endDate"],
    [{ endDate: "" }, "endDate"],
    [{ endDate: "2028-07-13" }, "endDate"],
    [{ title: "   " }, "title"],
    [{ type: "CRUISE" }, "type"],
    [{ currency: "XYZ" }, "currency"],
    [{ budget: "-5" }, "budget"],
    [{ budget: "12.345" }, "budget"],
    [{ travellers: "0" }, "travellers"],
    [{ coverImageUrl: "javascript:alert(1)" }, "coverImageUrl"],
    [{ coverImageUrl: "http://example.com/a.jpg" }, "coverImageUrl"],
  ])("rejects %o", (patch, field) => {
    const r = tripSchema.safeParse({ ...base, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe("calendar dates", () => {
  it("rejects dates that don't exist instead of rolling them over", () => {
    const base = { title: "T", type: "OTHER", currency: "EUR", budget: "", travellers: "1", description: "", coverImageUrl: "" };
    expect(tripSchema.safeParse({ ...base, startDate: "2027-02-30", endDate: "2027-03-05" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...base, startDate: "2027-13-01", endDate: "2027-13-05" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...base, startDate: "2028-02-29", endDate: "2028-03-05" }).success).toBe(true); // leap year
  });
});
