import type { ScenarioExpectation } from "./reflectionMetrics.js";

export interface ReflectionScenario {
  id: string;
  description: string;
  userTurns: string[];
  expectation: ScenarioExpectation;
  continueAfterProposal?: boolean;
}

const positive: ScenarioExpectation = { expectedProposal: true, proposalWindow: [2, 6] };

export const reflectionScenarios: ReflectionScenario[] = [
  {
    id: "positive-father-camping",
    description: "A warm, concrete memory with personal meaning",
    expectation: positive,
    userTurns: [
      "I keep thinking about a camping trip with my dad when I was ten.",
      "Our tent collapsed in the rain and Dad started laughing instead of getting angry.",
      "I remember the rain hitting the blue tarp and both of us trying to hold it up.",
      "It matters because his laughter made mistakes feel safe, and I want to remember that about him.",
      "I wish I had asked him more about that trip while he was still alive.",
      "The strongest image is his face under the flashlight while the tent sagged around us.",
    ],
  },
  {
    id: "difficult-work-experience",
    description: "A work event whose meaning emerges through detail",
    expectation: positive,
    userTurns: [
      "I finished everything on my list today but still felt behind.",
      "Right after I closed my laptop I remembered three other things I could have done.",
      "My shoulders stayed tense and I reopened the laptop even though nobody had asked me to.",
      "I realized finishing does not feel safe to me because I expect someone to find what I missed.",
      "What matters is that the pressure continued even after the work was actually complete.",
      "I want to remember that enough can be a complete outcome.",
    ],
  },
  {
    id: "relationship-misunderstanding",
    description: "A specific conflict and the user's own interpretation",
    expectation: positive,
    userTurns: [
      "I snapped at my partner over the dishes last night.",
      "They were scrolling on the couch while I cleaned the kitchen after dinner.",
      "I felt invisible and took that moment as proof they did not care about my effort.",
      "Later they told me they had a migraine and had not realized I wanted help.",
      "I want to remember how quickly I turned one quiet moment into a whole story.",
      "The important part is to ask what is happening before deciding what it means.",
    ],
  },
  {
    id: "recurring-pattern",
    description: "A recurring pattern grounded in examples and user-owned meaning",
    expectation: positive,
    userTurns: [
      "I keep abandoning personal projects right when they start becoming real.",
      "I stopped the photo book after choosing the final images, and I stopped the podcast after recording the pilot.",
      "In both cases I started researching new ideas instead of finishing.",
      "I feel excited while imagining possibilities and exposed when something is ready for other people to see.",
      "I think I am protecting the perfect version by never completing the actual version.",
      "That pattern matters because I want to finish the photo book this year.",
    ],
  },
  {
    id: "detailed-first-message",
    description: "A rich opening message that should not require an arbitrary minimum turn count",
    expectation: { expectedProposal: true, proposalWindow: [1, 3] },
    userTurns: [
      "This morning my daughter tied her own shoes before school, looked up at me, and shouted 'I did it.' I felt proud and unexpectedly sad because she is becoming independent so quickly. I want to remember her red backpack and the huge grin on her face.",
      "We were sitting on the hallway floor with sunlight coming through the front door.",
      "The sadness was really tenderness; I was seeing a small ordinary milestone become part of her growing up.",
      "Her grin is the part I most want to keep.",
      "I told her I was proud and she ran outside to show her brother.",
      "It matters because these ordinary mornings are changing before I notice.",
    ],
  },
  {
    id: "continue-after-proposal",
    description: "A user who keeps adding detail after a proposal becomes available",
    expectation: positive,
    continueAfterProposal: true,
    userTurns: [
      "I remember my grandmother teaching me to make bread.",
      "Her kitchen smelled like yeast and she let me press my whole hand into the dough.",
      "I felt trusted because she never corrected the shape I made.",
      "There is another part: she always hummed the same song while we waited for it to rise.",
      "I do not know the song's name, but hearing her hum made the kitchen feel calm.",
      "I want to remember the flour on her sleeves and how patient she was with me.",
    ],
  },
  {
    id: "vague-low-signal",
    description: "Broad mood labels should not be manufactured into a memory",
    expectation: { expectedProposal: false, minimumTurnsWithoutProposal: 6 },
    userTurns: [
      "I feel off.",
      "I don't know, just weird.",
      "Maybe I am tired.",
      "I am still not sure.",
      "Nothing specific comes to mind.",
      "I do not have anything else to add yet.",
    ],
  },
  {
    id: "repeated-uncertainty",
    description: "Repeated uncertainty is not itself an insight",
    expectation: { expectedProposal: false, minimumTurnsWithoutProposal: 6 },
    userTurns: [
      "Something happened this week but I cannot place it.",
      "I don't remember when.",
      "I am not sure who was there.",
      "Maybe it was at work, but I really don't know.",
      "No image or feeling is coming up.",
      "I think I need to come back to this later.",
    ],
  },
  {
    id: "advice-without-memory",
    description: "An advice request should not be converted into a memory without an event",
    expectation: { expectedProposal: false, minimumTurnsWithoutProposal: 6 },
    userTurns: [
      "Can you tell me how to be more productive?",
      "I just want general advice.",
      "There is not a particular day or event behind it.",
      "No, I cannot think of a specific example.",
      "I am asking what people usually do.",
      "We can stop because I do not have a memory to describe.",
    ],
  },
];
