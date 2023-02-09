import { Signer, ContractFactory } from "ethers";

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type Contract<F extends ContractFactory> = AsyncReturnType<F["deploy"]>;

type inputContracts = {
  [contractName: string]:
    | ReturnType<ReturnType<typeof initDeployOrAttach>["deployOrAttach"]>
    | ReturnType<ReturnType<typeof initDeployOrAttach>["attach"]>;
};

export type outputContracts = inputContracts & {
  connect: (signer: Signer) => outputContracts;
};

export interface ContractBuilder<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

export const buildContracts = <F extends { (signer?: Signer): inputContracts }>(func: F) => {
  return {
    connect: (signer: Signer) => func(signer),
    ...func(),
  } as ReturnType<F> & outputContracts;
};

export const initDeployOrAttach = (ethers: { getSigners(): Promise<any[]> }) => {
  const attach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ) => {
    return {
      attach: async (address: string, signer?: Signer): Promise<Contract<F>> => {
        const defaultSigner = initialSigner || (await ethers.getSigners())[0];
        return new FactoryConstructor(signer || defaultSigner).attach(address) as Contract<F>;
      },
    };
  };

  const deployOrAttach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ): ContractBuilder<F> => {
    // const contractName = FactoryConstructor.name.replace("__factory", "");
    return {
      deploy: async (...args: Parameters<F["deploy"]>): Promise<Contract<F>> => {
        const defaultSigner = initialSigner ?? (await ethers.getSigners())[0];
        return new FactoryConstructor(defaultSigner).deploy(...(args || [])) as Contract<F>;
      },
      attach: attach<F>(FactoryConstructor, initialSigner).attach,
    };
  };

  return {
    deployOrAttach,
    attach,
  };
};
