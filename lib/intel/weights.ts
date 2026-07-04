/* Scoring weights, in one place. They used to be literals scattered through the
   score formula; centralizing them makes the pipeline tunable and lets learned
   signals (team appetite) plug in cleanly. Defaults preserve the prior
   behavior; the team-appetite term is additive on top. */

export interface ScoreWeights {
  corroboration: number;
  reputation: number;
  freshness: number;
  freshnessHalfLifeH: number;
  resonance: number;
  /* How hard the table's collective taste for a lane nudges a story's score.
     Bounded: a strong market signal still surfaces in a cooled lane. */
  teamAppetite: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  corroboration: 3.0,
  reputation: 1.5,
  freshness: 3,
  freshnessHalfLifeH: 48,
  resonance: 2,
  teamAppetite: 2.5,
};
