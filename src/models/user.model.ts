import { Schema, model } from 'mongoose';

const addressSchema = new Schema(
  {
    apelido: { type: String, trim: true, default: '' },
    cep: { type: String, required: true, trim: true },
    logradouro: { type: String, required: true, trim: true },
    numero: { type: String, required: true, trim: true },
    complemento: { type: String, trim: true, default: '' },
    bairro: { type: String, trim: true, default: '' },
    cidade: { type: String, required: true, trim: true },
    uf: { type: String, required: true, trim: true, uppercase: true, maxlength: 2 },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false -> o hash nunca volta em consultas comuns (RNF002: nunca retornar passwordHash).
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['cliente', 'admin'], default: 'cliente' },
    consentLgpd: {
      aceito: { type: Boolean, required: true },
      data: { type: Date, required: true },
      versao: { type: String, required: true },
    },
    addresses: { type: [addressSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const UserModel = model('User', userSchema);
