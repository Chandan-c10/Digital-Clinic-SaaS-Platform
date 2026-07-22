import { parsePageParams, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination.util";

describe("parsePageParams", () => {
  it("defaults to page 1 and the default page size when nothing is given", () => {
    expect(parsePageParams()).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it("computes skip from page and pageSize", () => {
    expect(parsePageParams("3", "20")).toEqual({ page: 3, pageSize: 20, skip: 40, take: 20 });
  });

  it("clamps pageSize to MAX_PAGE_SIZE rather than allowing an unbounded request", () => {
    expect(parsePageParams("1", "999999")).toEqual({
      page: 1,
      pageSize: MAX_PAGE_SIZE,
      skip: 0,
      take: MAX_PAGE_SIZE,
    });
  });

  it("treats a zero/negative page as page 1, not a negative skip", () => {
    expect(parsePageParams("0", "10")).toEqual({ page: 1, pageSize: 10, skip: 0, take: 10 });
    expect(parsePageParams("-5", "10")).toEqual({ page: 1, pageSize: 10, skip: 0, take: 10 });
  });

  it("treats garbage input as the default rather than NaN propagating into skip/take", () => {
    expect(parsePageParams("not-a-number", "also-not-a-number")).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });
});
