import { BadRequestException } from '@nestjs/common';
import type { FieldDefinition } from '../constants/category-templates.const';

export function validateFields(
  fields: Record<string, unknown>,
  schema: FieldDefinition[],
): void {
  for (const definition of schema) {
    const value = fields[definition.key];

    if (definition.required && (value === undefined || value === null || value === '')) {
      throw new BadRequestException(
        `El campo "${definition.label}" (${definition.key}) es obligatorio`,
      );
    }

    if (value === undefined || value === null) {
      continue;
    }

    switch (definition.type) {
      case 'text':
      case 'textarea':
      case 'url':
      case 'markdown':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser texto`,
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser un numero`,
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser verdadero o falso`,
          );
        }
        break;

      case 'select':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser texto`,
          );
        }
        if (
          definition.options &&
          definition.options.length > 0 &&
          !definition.options.includes(value)
        ) {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser uno de: ${definition.options.join(', ')}`,
          );
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          throw new BadRequestException(
            `El campo "${definition.key}" debe ser un arreglo`,
          );
        }
        if (definition.options && definition.options.length > 0) {
          for (const item of value) {
            if (typeof item !== 'string' || !definition.options.includes(item)) {
              throw new BadRequestException(
                `El campo "${definition.key}" contiene un valor invalido: ${String(item)}`,
              );
            }
          }
        }
        break;

      default:
        break;
    }
  }
}
