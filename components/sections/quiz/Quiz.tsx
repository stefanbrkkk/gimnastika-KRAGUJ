/**
 * S2 QUIZ (light) — „Koji program je za vaše dete?“ (§5 S2, §4 Quiz).
 * Server component: builds the view model from content and renders
 *  - QuizApp: the interactive island (age → [experience] → result card, aria-live);
 *  - QuizGuide: the static no-JS age → group guide (hidden once html.js is set).
 */
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { QUIZ } from "@/content/copy";
import { typesetSr } from "@/lib/typeset";
import { QuizApp } from "./QuizApp";
import { QuizGuide } from "./QuizGuide";
import { buildQuizViewModel } from "./views";

export function Quiz() {
  const vm = buildQuizViewModel();
  return (
    <Section id="kviz" theme="light" labelledBy="kviz-title">
      <div className="container-site quiz-layout">
        <SectionHeading id="kviz-title" title={typesetSr(QUIZ.heading)} align="left" className="quiz-heading" />
        <div className="quiz-stage">
          <QuizApp vm={vm} />
          <QuizGuide />
        </div>
      </div>
    </Section>
  );
}
