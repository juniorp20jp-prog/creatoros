import type { YouTubeAnalyzerDictionary } from "../types";
import styles from "../youtube-analyzer.module.css";

export function AnalysisLimitations({
  content,
}: {
  content: YouTubeAnalyzerDictionary;
}) {
  return (
    <aside aria-labelledby="analysis-limitations-title" className={styles.limitationsPanel}>
      <h2 id="analysis-limitations-title">{content.limitations.title}</h2>
      <ul>
        {content.limitations.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
