import type {
  BaseRecord,
  CreateManyParams,
  CreateManyResponse,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteManyParams,
  DeleteManyResponse,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateManyParams,
  UpdateManyResponse,
  UpdateParams,
  UpdateResponse,
} from '@refinedev/core';
import type { SqlClient, SqlClientFactory } from './client';

export default (client: SqlClient | SqlClientFactory): DataProvider => {
  return {
    getList,
    getMany,
    getOne,
    create,
    createMany,
    update,
    updateMany,
    deleteOne,
    deleteMany,
  } as DataProvider;

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

  function getOne<T extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<T>> {
    throw new Error('Unimplemented');
  }

  function create<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateParams<Variables>,
  ): Promise<CreateResponse<T>> {
    throw new Error('Unimplemented');
  }

  function createMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: CreateManyParams<Variables>,
  ): Promise<CreateManyResponse<T>> {
    throw new Error('Unimplemented');
  }

  function update<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateParams<Variables>,
  ): Promise<UpdateResponse<T>> {
    throw new Error('Unimplemented');
  }

  function updateMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: UpdateManyParams<Variables>,
  ): Promise<UpdateManyResponse<T>> {
    throw new Error('Unimplemented');
  }

  function deleteOne<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteOneParams<Variables>,
  ): Promise<DeleteOneResponse<T>> {
    throw new Error('Unimplemented');
  }

  function deleteMany<T extends BaseRecord = BaseRecord, Variables = {}>(
    params: DeleteManyParams<Variables>,
  ): Promise<DeleteManyResponse<T>> {
    throw new Error('Unimplemented');
  }
};
