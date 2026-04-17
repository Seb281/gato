import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseJson,
  parseAnkiTsv,
  parseQuizletTsv,
  parsePlainText,
} from "../parsers";

const defaults = { sourceLanguage: "es", targetLanguage: "en" };

describe("parseCsv", () => {
  it("detects and skips a header row", () => {
    const input = [
      "concept,translation,sourceLanguage,targetLanguage",
      "perro,dog,es,en",
    ].join("\n");
    expect(parseCsv(input)).toEqual([
      {
        concept: "perro",
        translation: "dog",
        sourceLanguage: "es",
        targetLanguage: "en",
        state: undefined,
        userNotes: undefined,
      },
    ]);
  });

  it("treats headerless input as data", () => {
    const input = "perro,dog,es,en";
    expect(parseCsv(input)).toHaveLength(1);
  });

  it("honors quoted fields and escaped quotes", () => {
    const input = '"hola, amigo","hi, friend",es,en';
    const [row] = parseCsv(input);
    expect(row?.concept).toBe("hola, amigo");
    expect(row?.translation).toBe("hi, friend");
  });

  it("drops rows with fewer than four fields", () => {
    const input = "perro,dog,es\nperro,dog,es,en";
    expect(parseCsv(input)).toHaveLength(1);
  });

  it("captures optional state and userNotes columns", () => {
    const input = "perro,dog,es,en,learning,animal vocab";
    const [row] = parseCsv(input);
    expect(row?.state).toBe("learning");
    expect(row?.userNotes).toBe("animal vocab");
  });
});

describe("parseJson", () => {
  it("accepts a top-level array", () => {
    const input = JSON.stringify([
      { concept: "perro", translation: "dog", sourceLanguage: "es", targetLanguage: "en" },
    ]);
    expect(parseJson(input)).toHaveLength(1);
  });

  it("accepts an object with a `concepts` array", () => {
    const input = JSON.stringify({
      concepts: [{ concept: "perro", translation: "dog" }],
    });
    expect(parseJson(input)).toEqual([
      {
        concept: "perro",
        translation: "dog",
        sourceLanguage: "",
        targetLanguage: "",
        state: undefined,
        userNotes: undefined,
      },
    ]);
  });

  it("returns an empty array on invalid JSON", () => {
    expect(parseJson("not-json")).toEqual([]);
  });

  it("drops items missing required string fields", () => {
    const input = JSON.stringify([
      { concept: 1, translation: "dog" },
      { concept: "perro" },
      { concept: "gato", translation: "cat" },
    ]);
    expect(parseJson(input)).toHaveLength(1);
  });
});

describe("parseAnkiTsv", () => {
  it("skips # comment lines and stamps defaults onto every row", () => {
    const input = [
      "#separator:tab",
      "#html:false",
      "perro\tdog",
      "gato\tcat",
    ].join("\n");
    expect(parseAnkiTsv(input, defaults)).toEqual([
      { concept: "perro", translation: "dog", sourceLanguage: "es", targetLanguage: "en" },
      { concept: "gato", translation: "cat", sourceLanguage: "es", targetLanguage: "en" },
    ]);
  });

  it("drops rows without both columns populated", () => {
    const input = "perro\t\n\tdog\ngato\tcat";
    expect(parseAnkiTsv(input, defaults)).toHaveLength(1);
  });
});

describe("parseQuizletTsv", () => {
  it("detects tab delimiter from the first line", () => {
    const input = "perro\tdog\ngato\tcat";
    expect(parseQuizletTsv(input, defaults)).toHaveLength(2);
  });

  it("detects comma delimiter when no tab is present", () => {
    const input = "perro,dog\ngato,cat";
    const rows = parseQuizletTsv(input, defaults);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.concept).toBe("perro");
  });

  it("preserves everything after the first delimiter as the translation", () => {
    const input = "perro,dog, also hound";
    const [row] = parseQuizletTsv(input, defaults);
    expect(row?.translation).toBe("dog, also hound");
  });
});

describe("parsePlainText", () => {
  it("accepts multiple delimiters on a best-match basis", () => {
    const input = [
      "perro - dog",
      "gato — cat",
      "pájaro – bird",
      "caballo => horse",
      "vaca\tcow",
    ].join("\n");
    const rows = parsePlainText(input, defaults);
    expect(rows.map((r) => r.concept)).toEqual([
      "perro",
      "gato",
      "pájaro",
      "caballo",
      "vaca",
    ]);
    expect(rows.map((r) => r.translation)).toEqual([
      "dog",
      "cat",
      "bird",
      "horse",
      "cow",
    ]);
  });

  it("drops lines with no delimiter", () => {
    const input = "perro dog\ngato - cat";
    expect(parsePlainText(input, defaults)).toHaveLength(1);
  });
});
