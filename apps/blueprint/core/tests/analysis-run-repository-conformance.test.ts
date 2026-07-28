import {
  InMemoryAnalysisRunRepository,
} from "../persistence";
import {
  runAnalysisRunRepositoryContractTests,
} from "./fixtures/analysis-run-repository-contract";

runAnalysisRunRepositoryContractTests(
  "InMemoryAnalysisRunRepository",
  (clock) => ({
    repository: new InMemoryAnalysisRunRepository(clock),
  }),
);
