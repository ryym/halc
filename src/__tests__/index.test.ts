describe("sample test", () => {
  it("exports something", async () => {
    const mod = await import("..");
    expect(mod).not.toBe(null);
  });
});
