const { qwen, MODELS } = require('../qwen/client');
const { guardedCreate, getMaxOutputTokens } = require('../qwen/guardrails');

async function generateCounterHypotheses(primaryHypotheses, context = {}) {
  if (!primaryHypotheses || primaryHypotheses.length === 0) {
    return [];
  }

  const counterHypotheses = [];

  for (const hypothesis of primaryHypotheses) {
    try {
      const prompt = `
You are generating counter-hypotheses to reduce confirmation bias.

Primary Hypothesis: ${hypothesis.description || hypothesis}

Context: ${JSON.stringify(context)}

Generate 2-3 structurally different counter-hypotheses that:
1. Challenge the primary hypothesis
2. Offer alternative explanations
3. Consider edge cases or different root causes
4. Are plausible and evidence-based

Return as JSON array with structure:
[
  {
    "description": "Counter-hypothesis description",
    "reasoning": "Why this counter-hypothesis is plausible",
    "confidence": 0.0-1.0,
    "evidence_requirements": ["evidence needed to support this"]
  }
]
`;

      const res = await guardedCreate(qwen, {
        model: MODELS.PLUS,
        messages: [
          { role: 'system', content: 'You are a critical thinking assistant that generates counter-hypotheses to reduce confirmation bias.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: getMaxOutputTokens('counter_hypothesis')
      }, { module: 'counter-hypothesis', taskType: 'hypothesis_generation' });

      const result = JSON.parse(res.choices[0].message.content);
      const hypotheses = Array.isArray(result) ? result : [result];
      
      for (const ch of hypotheses) {
        counterHypotheses.push({
          ...ch,
          primary_hypothesis_id: hypothesis.id || hypothesis.description,
          type: 'counter',
          created_at: new Date().toISOString()
        });
      }

    } catch (e) {
      console.warn('[Counter-Hypothesis] Generation failed for hypothesis:', hypothesis.description, e.message);
    }
  }

  return counterHypotheses;
}

async function evaluateHypothesisCompetition(primaryHypotheses, counterHypotheses, evidence = []) {
  const evaluation = {
    primary_scores: {},
    counter_scores: {},
    winner: null,
    reasoning: ''
  };

  const allHypotheses = [
    ...primaryHypotheses.map(h => ({ ...h, type: 'primary' })),
    ...counterHypotheses.map(h => ({ ...h, type: 'counter' }))
  ];

  try {
    const prompt = `
Evaluate competing hypotheses based on available evidence.

Primary Hypotheses:
${primaryHypotheses.map((h, i) => `${i + 1}. ${h.description || h}`).join('\n')}

Counter-Hypotheses:
${counterHypotheses.map((h, i) => `${i + 1}. ${h.description}`).join('\n')}

Available Evidence:
${evidence.map((e, i) => `${i + 1}. ${e.content || e}`).join('\n')}

Evaluate each hypothesis on:
- Evidence support (0-1)
- Plausibility (0-1)
- Simplicity (0-1)
- Explanatory power (0-1)

Return as JSON:
{
  "evaluations": [
    {
      "hypothesis_description": "hypothesis text",
      "type": "primary|counter",
      "evidence_support": 0.0-1.0,
      "plausibility": 0.0-1.0,
      "simplicity": 0.0-1.0,
      "explanatory_power": 0.0-1.0,
      "overall_score": 0.0-1.0
    }
  ],
  "winner": "best hypothesis description",
  "reasoning": "explanation of why this hypothesis won"
}
`;

    const res = await guardedCreate(qwen, {
      model: MODELS.PLUS,
      messages: [
        { role: 'system', content: 'You are an objective evaluator of competing hypotheses.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: getMaxOutputTokens('hypothesis_evaluation')
    }, { module: 'counter-hypothesis', taskType: 'hypothesis_evaluation' });

    const result = JSON.parse(res.choices[0].message.content);

    for (const evalResult of result.evaluations) {
      if (evalResult.type === 'primary') {
        evaluation.primary_scores[evalResult.hypothesis_description] = evalResult.overall_score;
      } else {
        evaluation.counter_scores[evalResult.hypothesis_description] = evalResult.overall_score;
      }
    }

    evaluation.winner = result.winner;
    evaluation.reasoning = result.reasoning;

  } catch (e) {
    console.warn('[Counter-Hypothesis] Evaluation failed:', e.message);
  }

  return evaluation;
}

module.exports = {
  generateCounterHypotheses,
  evaluateHypothesisCompetition
};
