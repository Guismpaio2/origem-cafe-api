import type { Request, Response } from 'express';
import { deleteAccount, addAddress, removeAddress, updateProfile } from '../services/account.service.js';
import { lookupCep } from '../services/cep.service.js';
import { addAddressBody, addressIdParams, cepParams, deleteAccountBody, updateProfileBody } from '../validators/account.validator.js';

function currentUserId(response: Response): string {
  return (response.locals.auth as { userId: string }).userId;
}

export async function updateProfileController(request: Request, response: Response) {
  const body = updateProfileBody.parse(request.body);
  response.json({ data: await updateProfile(currentUserId(response), body) });
}

export async function addAddressController(request: Request, response: Response) {
  const body = addAddressBody.parse(request.body);
  response.status(201).json({ data: await addAddress(currentUserId(response), body) });
}

export async function removeAddressController(request: Request, response: Response) {
  const { addressId } = addressIdParams.parse(request.params);
  response.json({ data: await removeAddress(currentUserId(response), addressId) });
}

export async function deleteAccountController(request: Request, response: Response) {
  deleteAccountBody.parse(request.body);
  await deleteAccount(currentUserId(response));
  response.status(204).end();
}

export async function cepController(request: Request, response: Response) {
  const { cep } = cepParams.parse(request.params);
  response.json({ data: await lookupCep(cep) });
}
