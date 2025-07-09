import type {
  BaseRecord,
  DataProvider,
  GetListParams,
  GetManyParams,
  GetManyResponse,
} from '@refinedev/core';

type CreateDataProviderOptions = { url: string | URL };

export default ({ url }: CreateDataProviderOptions): DataProvider => {
  return { getApiUrl: undefined as any as () => string, getList, getMany };

  function getList<T extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<T> {
    throw new Error('Unimplemented');
  }

  function getMany<T extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<T>> {
    throw new Error('Unimplemented');
  }
};
