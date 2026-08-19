/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as atividades from "../atividades.js";
import type * as atribuicoes from "../atribuicoes.js";
import type * as auth from "../auth.js";
import type * as campo from "../campo.js";
import type * as email from "../email.js";
import type * as ordensServico from "../ordensServico.js";
import type * as pontos from "../pontos.js";
import type * as relatorios from "../relatorios.js";
import type * as tecnicos from "../tecnicos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  atividades: typeof atividades;
  atribuicoes: typeof atribuicoes;
  auth: typeof auth;
  campo: typeof campo;
  email: typeof email;
  ordensServico: typeof ordensServico;
  pontos: typeof pontos;
  relatorios: typeof relatorios;
  tecnicos: typeof tecnicos;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
