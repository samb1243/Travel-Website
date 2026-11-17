import { describe, expect, it } from "vitest";
import { itemSchema } from "./item";
import { stopSchema } from "./stop";

const item = {
  stopId: "stop1",
  category: "TRANSPORT",
  title: "",
  provider: "",
  startDate: "2027-02-04",
  startTime: "18:40",
  endDate: "2027-02-05",
  endTime: "07:15",
  fromPlace: "Bangkok",
  toPlace: "Chiang Mai",
  cost: "38",
  status: "BOOKED",
  confirmationCode: "",
  notes: "",
  privateNotes: "",
  links: [{ kind: "BOOKING", label: "", url: "https://12go.asia" }],
};

describe("itemSchema", () => {
  it("names transport after its route and builds wall-clock times", () => {
    const r = itemSchema.parse(item);
    expect(r.title).toBe("Bangkok → Chiang Mai");
    expect(r.startAt?.toISOString()).toBe("2027-02-04T18:40:00.000Z");
    expect(r.endAt?.toISOString()).toBe("2027-02-05T07:15:00.000Z");
    expect(r.allDay).toBe(false);
    expect(r.cost).toBe(38);
    expect(r.links[0].label).toBeNull();
  });

  it("treats a date without a time as all-day", () => {
    const r = itemSchema.parse({ ...item, startTime: "", endDate: "", endTime: "" });
    expect(r.allDay).toBe(true);
    expect(r.endAt).toBeNull();
  });

  it("allows an item with no dates", () => {
    const r = itemSchema.parse({ ...item, startDate: "", startTime: "", endDate: "", endTime: "" });
    expect(r.startAt).toBeNull();
    expect(r.allDay).toBe(false);
  });

  it.each([
    [{ title: "", fromPlace: "" }, "title"],
    [{ endDate: "2027-02-04", endTime: "07:00" }, "endDate"],
    [{ startDate: "", startTime: "10:00", endDate: "", endTime: "" }, "startDate"],
    [{ startTime: "25:00" }, "startTime"],
    [{ status: "MAYBE" }, "status"],
    [{ cost: "abc" }, "cost"],
    [{ links: [{ kind: "BOOKING", label: "", url: "javascript:alert(1)" }] }, "links"],
    [{ links: [{ kind: "BOOKING", label: "", url: "booking.com" }] }, "links"],
    [{ links: Array.from({ length: 11 }, () => ({ kind: "OTHER", label: "", url: "https://a.com" })) }, "links"],
  ])("rejects %o", (patch, field) => {
    const r = itemSchema.safeParse({ ...item, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe("stopSchema", () => {
  const stop = {
    name: " Lisbon ",
    region: "",
    country: "Portugal",
    countryCode: "pt",
    placeId: "osm:relation:5400890",
    lat: 38.7223,
    lng: -9.1393,
    arriveOn: "2027-05-01",
    departOn: "2027-05-04",
    notes: "",
  };

  it("accepts a geocoded stop", () => {
    const r = stopSchema.parse(stop);
    expect(r.name).toBe("Lisbon");
    expect(r.countryCode).toBe("PT");
  });

  it("accepts a stop with no location", () => {
    expect(stopSchema.safeParse({ ...stop, lat: null, lng: null, placeId: "" }).success).toBe(true);
  });

  it.each([
    [{ departOn: "2027-04-30" }, "departOn"],
    [{ lat: 91 }, "lat"],
    [{ lng: null }, "lat"],
    [{ countryCode: "PRT" }, "countryCode"],
    [{ placeId: "evil" }, "placeId"],
    [{ name: "" }, "name"],
  ])("rejects %o", (patch, field) => {
    const r = stopSchema.safeParse({ ...stop, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});
