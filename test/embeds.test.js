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
    const paramsField = embed.fields.find((f) => f.name === "⚙️ Proposed Parameters");
    expect(paramsField.value).toContain("sma_short = 40");
    expect(paramsField.value).not.toMatch(/truncated/);
    expect(embed.footer.text).toBe("Proposal #abc-123");
    expect(embed.fields.find((f) => f.name === "🎯 Confidence").value).toContain("68%");
  });

  test("uses the right title, emoji, and color per status/strategy", () => {
    const base = {
      id: "abc-123",
      created_at: new Date().toISOString(),
      proposal_type: "new_strategy_idea",
      target_strategy: "new",
      new_strategy_description: "Try a volatility breakout strategy.",
      rationale: "Diversify beyond momentum/mean-reversion.",
      confidence: 55,
      status: "approved",
    };
    const embed = proposalEmbed(base).toJSON();
    expect(embed.title).toBe("💡 New Strategy Idea");
    expect(embed.color).toBe(0x2ecc71);
    expect(embed.fields.find((f) => f.name === "Status").value).toContain("Approved");
  });
});
