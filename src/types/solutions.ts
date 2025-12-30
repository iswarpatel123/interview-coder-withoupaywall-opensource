export interface Solution {
  initial_thoughts: string[]
  thought_steps: string[]
  description: string
  code: string
}

export interface SolutionsResponse {
  [key: string]: Solution
}

export interface ProblemStatementData {
  problem_statement: string
  constraints?: any
  example_input?: any
  example_output?: any
  solution_stub?: any
  notes?: any
}
