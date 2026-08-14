/**
 * Source-analysis facade for the rc.6 Typert generator.
 *
 * The published generator recognizes its marker symbols through an ambient
 * declaration owned by this exact module name. Published npm declarations are
 * external modules instead, so an independent package supplies this compile-
 * time-only facade while runtime imports remain externalized to the official
 * package.
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
  import { Service, type Context } from '@deepseek-ai/cordis'

  declare const LOOKUP_HOST: unique symbol
  declare const LOOKUP_WIRE: unique symbol
  declare const CONTEXT_WIRE: unique symbol

  /** Type-only association between one Host object and its wire identity. */
  export interface TypertLookup<Host, Wire> {
    readonly [LOOKUP_HOST]: Host
    readonly [LOOKUP_WIRE]: Wire
  }

  /** Type-only association between one scoped Context and its wire identity. */
  export interface TypertContext<Wire> {
    readonly [CONTEXT_WIRE]: Wire
  }

  /** Merge-extensible Host lookup declarations. */
  export interface TypertLookupMap {}
  /** Merge-extensible scoped Context declarations. */
  export interface TypertContextMap {}

  /** Visible Service-to-Gateway binding. */
  export interface TypertGatewayBinding<ServiceType extends object = object> {
    readonly service: ServiceType
    readonly serviceKey: string
    readonly namespace: string
  }

  /** Cordis Service base whose methods may be exposed through Typert. */
  export abstract class TypertRemoteService<out T = never> extends Service<T> {
    readonly typertRemote: TypertGatewayBinding<this>
    protected constructor(ctx: Context, serviceKey: string)
  }

  type RemoteMethodDecorator = <This extends object, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ) => void

  /** Mark one public Service method as a Remote invocation. */
  export function Remote<This extends object, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ): void
  /** Mark one public Service method under an explicit Remote endpoint name. */
  export function Remote(exportName: string): RemoteMethodDecorator
}
