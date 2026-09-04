const { proposalEmbed, truncate, FIELD_VALUE_LIMIT } = require("../src/embeds");

describe("truncate", () => {
  test("leaves short strings untouched", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("truncates to the limit and marks it", () => {
    const long = "x".repeat(2000);
    const result = truncate(long, 100);
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(/truncated/);
  });
});

describe("proposalEmbed", () => {
  test("never produces a field value over Discord's 1024-char limit, even with a huge params object", () => {
    const hugeParams = {};
    for (let i = 0; i < 200; i++) hugeParams[`param_${i}`] = "a".repeat(50);

    const proposal = {
      id: "abc-123",
      created_at: new Date().toISOString(),
      proposal_type: "parameter_tweak",
      target_strategy: "momentum",
      proposed_params: hugeParams,
      rationale: "y".repeat(5000),
      confidence: 70,
      estimated_impact: "z".repeat(5000),
      status: "pending",
    };

    const embed = proposalEmbed(proposal);
    const json = embed.toJSON();
    for (const field of json.fields) {
      expect(field.value.length).toBeLessThanOrEqual(FIELD_VALUE_LIMIT);
    }
  });

  test("handles a normal small proposal without truncation artifacts", () => {
    const proposal = {
      id: "abc-123",
      created_at: new Date().toISOString(),
      proposal_type: "parameter_tweak",
      target_strategy: "momentum",
      proposed_params: { sma_short: 40 },
      rationale: "Momentum entries have lagged recent trend shifts.",
      confidence: 68,
      estimated_impact: "May catch trends slightly earlier.",
      status: "pending",
    };

    const embed = proposalEmbed(proposal).toJSON();
    expect(embed.fields.find((f) => f.name === "Proposed params").value).toBe("sma_short = 40");
    expect(embed.fields.find((f) => f.name === "Proposed params").value).not.toMatch(/truncated/);
  });
});
