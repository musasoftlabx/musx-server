type TParams = { body: any; set: any; error: any };

export default async function castError(params: TParams) {
  const { body } = params;

  console.log("castError", body);

  return {};
}
