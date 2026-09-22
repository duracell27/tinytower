import { IsString, IsNotEmpty } from 'class-validator';

export class NotifyPurchaseDto {
  @IsString()
  @IsNotEmpty()
  packId!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;
}
