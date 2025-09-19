import OpenAI from "openai";
import { writeFile } from "fs/promises";

export type Prompt = {
  error: any;
  query: { prompt: string };
};

export default async function generateImageAI(params: Prompt) {
  const {
    //error,
    query: { prompt },
  } = params;

  try {
    const client = new OpenAI({
      apiKey: "",
    });

    return await client.responses.create({
      model: "gpt-4.1",
      input: "Tell me a three sentence bedtime story about a unicorn.",
    });

    // const img = await client.images.generate({
    //   model: "gpt-image-1",
    //   prompt: "A cute baby sea otter",
    //   n: 1,
    //   size: "1024x1024",
    // });

    // const imageBuffer = Buffer.from(img.data[0].b64_json, "base64");
    // await writeFile("output.png", imageBuffer);
  } catch (err: any) {
    return {
      subject: "Image Generation Error ",
      body: err.message,
    };
    // return error(500, {
    //   subject: "Image Generation Error ",
    //   body: err.message,
    // });
  }
}
