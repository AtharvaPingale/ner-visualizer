export type ExampleKey = "news" | "biography" | "tech" | "multilingual";

export const EXAMPLES: Record<ExampleKey, { label: string; text: string }> = {
  news: {
    label: "News article",
    text: "President Joe Biden met with German Chancellor Olaf Scholz in Berlin on Tuesday to discuss NATO's response to ongoing tensions in Eastern Europe. The talks at the German Chancellery focused primarily on Ukraine, where President Volodymyr Zelensky has continued to request additional military support from Washington and Brussels. Secretary of State Antony Blinken accompanied Biden alongside National Security Advisor Jake Sullivan. France's President Emmanuel Macron joined virtually from Paris.",
  },
  biography: {
    label: "Biography",
    text: "Marie Curie was born Maria Skłodowska in Warsaw in 1867. She left for Paris in 1891 to study at the Sorbonne, where she met Pierre Curie. Together, Marie and Pierre Curie discovered polonium and radium. In 1903, they shared the Nobel Prize in Physics with Henri Becquerel. After Pierre's death in 1906, Marie took over his teaching position at the Sorbonne. She won a second Nobel Prize in Chemistry in 1911.",
  },
  tech: {
    label: "Tech article",
    text: "Google announced a sweeping partnership with OpenAI and Microsoft to standardize safety benchmarks for frontier AI models. The Mountain View company will collaborate with Anthropic, Meta, and Amazon on a shared evaluation framework. Apple and IBM declined initial participation. Nvidia acquired a small startup in San Francisco, while Salesforce expanded its partnership with Hugging Face. Oracle, SAP, Cisco, Intel, and AMD also indicated they would back the suite.",
  },
  multilingual: {
    label: "Multilingual",
    text: "Angela Merkel war Bundeskanzlerin in Berlin. Emmanuel Macron habite à Paris. Pedro Sánchez vive en Madrid. Giorgia Meloni lavora a Roma. Justin Trudeau served as Prime Minister of Canada and resided in Ottawa.",
  },
};
