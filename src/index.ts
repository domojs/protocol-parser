import * as debug from 'debug'
const log = debug('domojs:protocol-parser');
const verboseLog = debug('domojs:protocol-parser:verbose');

export type uint8 = number;
export type uint16 = number;
export type uint32 = number;
export type uint64 = string;
export type int8 = number;
export type int16 = number;
export type int32 = number;
export type float = number;
export type double = number;

export type subByteFrameType = 'bit' | 'uint2' | 'uint3' | 'uint4' | 'uint5' | 'uint6' | 'uint7';
export type simpleFrameType = subByteFrameType | 'uint8' | 'uint16' | 'uint32' | 'uint16LE' | 'uint32LE' | 'uint64';
export type complexFrameType = 'string' | 'buffer' | 'uint8[]' | 'uint16[]' | 'uint32[]' | 'uint64[]';;
export type frameType = simpleFrameType | complexFrameType | 'subFrame' | 'subFrame[]';
export type frameTypeGetter<T, U extends frameType> = ((instance: T, buffer?: Buffer) => U);

enum BitLength
{
    bit = 1,
    uint2 = 2,
    uint3 = 3,
    uint4 = 4,
    uint5 = 5,
    uint6 = 6,
    uint7 = 7
}

export function ArrayOf(type: Exclude<simpleFrameType, subByteFrameType>, length?: number): Exclude<complexFrameType, 'string' | 'buffer'>
{
    if (typeof (length) !== 'undefined')
        return type + '[' + length + ']' as any;
    return type + '[]' as any;
}

export interface SimpleFrameDescription<T>
{
    name: keyof T;
    type: simpleFrameType | frameTypeGetter<T, simpleFrameType>;
    optional?: boolean;
}
export interface ComplexFrameDescription<T>
{
    name: keyof T;
    type: complexFrameType | frameTypeGetter<T, complexFrameType>;
    length?: simpleFrameType | number;
    optional?: boolean;
}

export interface SubFrameDescription<T, U> 
{
    name: keyof T;
    type: 'subFrame';
    length?: simpleFrameType;
    optional?: boolean;
    choose?: { discriminator: keyof T, subFrame: { [key: number]: Frame<U> } }
}

export interface SubFrameArrayDescription<T, U> 
{
    name: keyof T;
    type: 'subFrame[]';
    length: simpleFrameType | number;
    optional?: boolean;
    frame: Frame<U>
}

export type FrameDescription<T> = SimpleFrameDescription<T> | ComplexFrameDescription<T> | SubFrameDescription<T, any> | SubFrameArrayDescription<T, any>;

export function frameTypeLength(type: 'bit'): 0.125
export function frameTypeLength(type: 'uint2'): 0.25
export function frameTypeLength(type: 'uint3'): 0.375
export function frameTypeLength(type: 'uint4'): 0.5
export function frameTypeLength(type: 'uint5'): 0.625
export function frameTypeLength(type: 'uint6'): 0.75
export function frameTypeLength(type: 'uint7'): 0.875
export function frameTypeLength(type: 'uint8'): 1
export function frameTypeLength(type: 'uint8'): 1
export function frameTypeLength(type: 'uint16'): 2
export function frameTypeLength(type: 'uint16LE'): 2
export function frameTypeLength(type: 'uint32'): 4
export function frameTypeLength(type: 'uint32LE'): 4
export function frameTypeLength(type: 'uint64'): 8
export function frameTypeLength(type: complexFrameType | 'subFrame'): -1
export function frameTypeLength(type: 'uint8'): 1
export function frameTypeLength(type: frameType): number
export function frameTypeLength(type: frameType)
{
    switch (type)
    {
        case 'bit':
            return 0.125;
        case 'uint2':
            return 0.25;
        case 'uint3':
            return 0.375;
        case 'uint4':
            return 0.5;
        case 'uint5':
            return 0.625;
        case 'uint6':
            return 0.75;
        case 'uint7':
            return 0.875;
        case 'uint8':
            return 1;
        case 'uint16':
        case 'uint16LE':
            return 2;
        case 'uint32':
        case 'uint32LE':
            return 4;
        case 'uint64':
            return 8;
        case 'buffer':
        case 'string':
        case 'subFrame':
        case 'uint8[]':
        case 'uint16[]':
        case 'uint32[]':
        case 'uint64[]':
        case 'subFrame[]':
            return -1;
        default:
            throw new Error(type + ' is not supported');
    }
}

export function write(buffer: Buffer, value: any, desc: FrameDescription<any>, fullFrame: FrameDescription<any>[], offset: number = 0)
{
    verboseLog(`writing ${JSON.stringify(value)} from ${JSON.stringify(desc)}`);

    var type: frameType;

    if (desc.type instanceof Function)
        type = desc.type(value, buffer);
    else
        type = desc.type;

    var lengthOfArray = -1;
    if (type.indexOf('[') > -1)
    {
        lengthOfArray = Number(type.substring(type.indexOf('['), type.indexOf(']')));
        type = type.substring(0, type.indexOf('[') + 1) + ']' as complexFrameType;
    }

    var floorOffset = Math.floor(offset);
    var subByteOffset = (offset - floorOffset) * 8;

    switch (type)
    {
        case 'bit':
            var currentValue = buffer.readUInt8(floorOffset);
            value = (value && 1 || 0) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint2':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 6)
            {
                write(buffer, ((value >> 1) && 1 || 0), Object.assign({}, desc, { type: 'bit' }), fullFrame, offset)
                offset += 1 / 8;
                write(buffer, ((value) && 1 || 0), Object.assign({}, desc, { type: 'bit' }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b11) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint3':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 5)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[3 - 8 + subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b111) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint4':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 4)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[4 - 8 + subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b1111) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint5':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 3)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[5 - 8 + subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b11111) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint6':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 2)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[6 - 8 + subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b111111) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint7':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 1)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[7 - 8 + subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            value = (value & 0b1111111) << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint8':
            if (offset != floorOffset)
            {
                write(buffer, value, Object.assign({}, desc, { type: BitLength[8 - subByteOffset] }), fullFrame, offset)
                offset = floorOffset + 1;
                write(buffer, value >> (8 - subByteOffset), Object.assign({}, desc, { type: BitLength[subByteOffset] }), fullFrame, offset)
                break;
                throw new Error('Cross byte value are not supported');
            }
            buffer.writeUInt8(value, offset);
            break;
        case 'uint16':
            if (offset != floorOffset)
            {
                write(buffer, value >> 8, Object.assign({}, desc, { type: 'uint8' }), fullFrame, offset)
                write(buffer, value & 0xFF, Object.assign({}, desc, { type: 'uint8' }), fullFrame, offset + 1)
                break;
                throw new Error('Cross byte value are not supported');
            }
            buffer.writeUInt16BE(value, offset);
            break;
        case 'uint32':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(4);
                tmpBuffer.writeUInt32BE(value, 0);
                write(buffer, tmpBuffer.readUInt16BE(0), Object.assign({}, desc, { type: 'uint16' }), fullFrame, offset);
                offset += 2;
                write(buffer, tmpBuffer.readUInt16BE(2), Object.assign({}, desc, { type: 'uint16' }), fullFrame, offset);
                break;
                throw new Error('Cross byte value are not supported');
            }
            buffer.writeUInt32BE(value, offset);
            break;
        case 'uint16LE':
            if (offset != floorOffset)
            {
                write(buffer, value & 0xFF, Object.assign({}, desc, { type: 'uint8' }), fullFrame, offset)
                write(buffer, value >> 8, Object.assign({}, desc, { type: 'uint8' }), fullFrame, offset + 1)
                break;
                throw new Error('Cross byte value are not supported');
            }
            buffer.writeUInt16LE(value, offset);
            break;
        case 'uint32LE':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(4);
                tmpBuffer.writeUInt32LE(value, 0);
                write(buffer, tmpBuffer.readUInt16LE(2), Object.assign({}, desc, { type: 'uint16LE' }), fullFrame, offset);
                write(buffer, tmpBuffer.readUInt16LE(0), Object.assign({}, desc, { type: 'uint16LE' }), fullFrame, offset + 2);
                break;
                throw new Error('Cross byte value are not supported');
            }
            buffer.writeUInt32LE(value, offset);
            break;
        case 'uint64':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            buffer.write(value, offset);
            break;
        case 'uint8[]':
        case 'uint16[]':
        case 'uint32[]':
        case 'uint64[]':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            if (typeof ((desc as ComplexFrameDescription<any>).length) != 'undefined')
            {
                var length = (desc as ComplexFrameDescription<any>).length as simpleFrameType;
                if (!isNaN(<any>length))
                    throw new Error('Not supported');

                var subType = type.substring(0, type.length - 2) as simpleFrameType;
                buffer = Buffer.alloc(frameTypeLength(length) + value.length * frameTypeLength(subType));
                write(buffer, value.length, { name: '', type: length }, fullFrame, offset);
                offset += frameTypeLength(length);
                for (var v of value)
                {
                    write(buffer, v, { name: '', type: subType }, fullFrame, offset);
                    offset += frameTypeLength(subType);
                }
                return buffer;
            }
            else if (lengthOfArray > -1)
            {
                buffer = Buffer.alloc(value.length * frameTypeLength(subType));
                for (var v of value)
                {
                    write(buffer, v, { name: '', type: subType }, fullFrame, offset);
                    offset += frameTypeLength(subType);
                }
                return buffer;
            }
            throw new Error('Not supported');
        case 'subFrame[]':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            let buffers: Buffer[] = [];
            if (typeof ((desc as ComplexFrameDescription<any>).length) != 'undefined')
            {
                var length = (desc as ComplexFrameDescription<any>).length as simpleFrameType;
                if (isNaN(<any>length))
                {
                    buffers.push(buffer = Buffer.alloc(frameTypeLength(length)));
                    write(buffer, value.length, { name: '', type: length }, fullFrame, offset);
                }
            }
            for (let v of value)
                buffers.push((<SubFrameArrayDescription<any, any>>desc).frame.write(v))
            return Buffer.concat(buffers);
        case 'buffer':
        case 'string':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            if (typeof ((desc as ComplexFrameDescription<any>).length) != 'undefined')
            {
                var length = (desc as ComplexFrameDescription<any>).length as simpleFrameType;
                if (isNaN(<any>length))
                {
                    buffer = Buffer.alloc(value.length + frameTypeLength(length));
                    if (typeof (write(buffer, value.length, { name: '', type: length }, fullFrame, 0)) != 'undefined')
                        throw new Error('Not supported');

                    offset = buffer.length - value.length;
                }
                else
                    buffer = Buffer.alloc(value.length);
            }
            else if (desc.type == 'buffer')
                return value[desc.name] as Buffer;

            if (!buffer)
                return Buffer.from(value[desc.name]);

            buffer.write(value, offset);

            return buffer;
        case 'subFrame':
            if (!(value[(desc as SubFrameDescription<any, any>).choose.discriminator] in (desc as SubFrameDescription<any, any>).choose.subFrame))
                throw new Error('Unsupported type ' + value[(desc as SubFrameDescription<any, any>).choose.discriminator]);

            buffer = (desc as SubFrameDescription<any, any>).choose.subFrame[value[(desc as SubFrameDescription<any, any>).choose.discriminator]].write(value[desc.name]);
            if (typeof ((desc as SubFrameDescription<any, any>).length) == 'undefined')
                return buffer;
            var subBuffer = Buffer.alloc(buffer.length + frameTypeLength((desc as SubFrameDescription<any, any>).length));
            buffer.copy(subBuffer, subBuffer.length - buffer.length);
            return write(subBuffer, buffer.length, { type: (desc as SubFrameDescription<any, any>).length, name: '' }, fullFrame, 0);
    }
}

export function read(buffer: Buffer, desc: FrameDescription<any>, offset: number, frames: FrameDescription<any>[], length?: number)
{
    var floorOffset = Math.floor(offset);
    var currentValue = buffer.readUInt8(floorOffset);
    var subByteOffset = (offset - floorOffset) * 8;

    var lengthOfArray = -1;
    var type = desc.type;
    if (type instanceof Function)
        throw new Error('Not supported');

    if (type.indexOf('[') > -1)
    {
        lengthOfArray = Number(type.substring(type.indexOf('['), type.indexOf(']')));
        type = type.substring(0, type.indexOf('[') + 1) + ']' as complexFrameType;
        if (!isNaN(lengthOfArray))
            return read(buffer, Object.assign({}, desc, { type: type }), offset, frames, lengthOfArray);
    }

    var value;

    switch (desc.type)
    {
        case 'bit':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b00000001);
                case 1:
                    return (currentValue & 0b00000010) >> subByteOffset;
                case 2:
                    return (currentValue & 0b00000100) >> subByteOffset;
                case 3:
                    return (currentValue & 0b00001000) >> subByteOffset;
                case 4:
                    return (currentValue & 0b00010000) >> subByteOffset;
                case 5:
                    return (currentValue & 0b00100000) >> subByteOffset;
                case 6:
                    return (currentValue & 0b01000000) >> subByteOffset;
                case 7:
                    return (currentValue & 0b10000000) >> subByteOffset;
            }
            break;
        case 'uint2':
            switch (subByteOffset)
            {
                case 0:
                    return currentValue & 0b00000011;
                case 1:
                    return (currentValue & 0b00000110) >> subByteOffset;
                case 2:
                    return (currentValue & 0b00001100) >> subByteOffset;
                case 3:
                    return (currentValue & 0b00011000) >> subByteOffset;
                case 4:
                    return (currentValue & 0b00110000) >> subByteOffset;
                case 5:
                    return (currentValue & 0b01100000) >> subByteOffset;
                case 6:
                    return (currentValue & 0b11000000) >> subByteOffset;
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);

                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint3':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b00000111);
                case 1:
                    return (currentValue & 0b00001110) >> subByteOffset;
                case 2:
                    return (currentValue & 0b00011100) >> subByteOffset;
                case 3:
                    return (currentValue & 0b00111000) >> subByteOffset;
                case 4:
                    return (currentValue & 0b01110000) >> subByteOffset;
                case 5:
                    return (currentValue & 0b11100000) >> subByteOffset;
                case 6:
                    value = (currentValue & 0b11000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint4':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b00001111);
                case 1:
                    return (currentValue & 0b00011110) >> subByteOffset;
                case 2:
                    return (currentValue & 0b00111100) >> subByteOffset;
                case 3:
                    return (currentValue & 0b01111000) >> subByteOffset;
                case 4:
                    return (currentValue & 0b11110000) >> subByteOffset;
                case 5:
                    value = (currentValue & 0b11100000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                case 6:
                    value = (currentValue & 0b11000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000111) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint5':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b00011111);
                case 1:
                    return (currentValue & 0b00111110) >> subByteOffset;
                case 2:
                    return (currentValue & 0b01111100) >> subByteOffset;
                case 3:
                    return (currentValue & 0b11111000) >> subByteOffset;
                case 4:
                    value = (currentValue & 0b11110000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                case 5:
                    value = (currentValue & 0b11100000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                case 6:
                    value = (currentValue & 0b11000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000111) << (8 - subByteOffset));
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00001111) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint6':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b00111111);
                case 1:
                    return (currentValue & 0b01111110) >> subByteOffset;
                case 2:
                    return (currentValue & 0b11111100) >> subByteOffset;
                case 3:
                    value = (currentValue & 0b11111000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                case 4:
                    value = (currentValue & 0b11110000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                case 5:
                    value = (currentValue & 0b11100000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000111) << (8 - subByteOffset));
                case 6:
                    value = (currentValue & 0b11000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00001111) << (8 - subByteOffset));
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00011111) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint7':
            switch (subByteOffset)
            {
                case 0:
                    return (currentValue & 0b01111111);
                case 1:
                    return (currentValue & 0b11111110) >> subByteOffset;
                case 2:
                    value = (currentValue & 0b11111100) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                case 3:
                    value = (currentValue & 0b11111000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                case 4:
                    value = (currentValue & 0b11110000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00000111) << (8 - subByteOffset));
                case 5:
                    value = (currentValue & 0b11100000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00001111) << (8 - subByteOffset));
                case 6:
                    value = (currentValue & 0b11000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00011111) << (8 - subByteOffset));
                case 7:
                    value = (currentValue & 0b10000000) >> subByteOffset;
                    currentValue = buffer.readUInt8(floorOffset + 1);
                    return value | ((currentValue & 0b00111111) << (8 - subByteOffset));
                default:
                    throw new Error('invalid offset');
            }
            break;
        case 'uint8':
            if (offset != floorOffset)
            {
                switch (subByteOffset)
                {
                    case 1:
                        value = (currentValue & 0b11111110) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00000001) << (8 - subByteOffset));
                    case 2:
                        value = (currentValue & 0b11111100) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00000011) << (8 - subByteOffset));
                    case 3:
                        value = (currentValue & 0b11111000) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00000111) << (8 - subByteOffset));
                    case 4:
                        value = (currentValue & 0b11110000) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00001111) << (8 - subByteOffset));
                    case 5:
                        value = (currentValue & 0b11100000) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00011111) << (8 - subByteOffset));
                    case 6:
                        value = (currentValue & 0b11000000) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b00111111) << (8 - subByteOffset));
                    case 7:
                        value = (currentValue & 0b10000000) >> subByteOffset;
                        currentValue = buffer.readUInt8(floorOffset + 1);
                        return value | ((currentValue & 0b01111111) << (8 - subByteOffset));
                    default:
                        throw new Error('invalid offset');
                }
            }

            return buffer.readUInt8(offset);
        case 'uint16':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(2);
                tmpBuffer.writeUInt8(read(buffer, Object.assign({}, desc, { type: 'uint8' }), offset, frames, length), 0);
                tmpBuffer.writeUInt8(read(buffer, Object.assign({}, desc, { type: 'uint8' }), offset + 1, frames, length), 1);
                return tmpBuffer.readUInt16BE(0);
            }
            return buffer.readUInt16BE(offset);
        case 'uint32':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(4);
                tmpBuffer.writeUInt16BE(read(buffer, Object.assign({}, desc, { type: 'uint16' }), offset, frames, length), 0);
                tmpBuffer.writeUInt16BE(read(buffer, Object.assign({}, desc, { type: 'uint16' }), offset + 2, frames, length), 2);
                return tmpBuffer.readUInt32BE(0);
            }
            return buffer.readUInt32BE(offset);
        case 'uint16LE':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(2);
                tmpBuffer.writeUInt8(read(buffer, Object.assign({}, desc, { type: 'uint8' }), offset, frames, length), 0);
                tmpBuffer.writeUInt8(read(buffer, Object.assign({}, desc, { type: 'uint8' }), offset + 1, frames, length), 1);
                return tmpBuffer.readUInt16LE(0);
            }
            return buffer.readUInt16LE(offset);
        case 'uint32LE':
            if (offset != floorOffset)
            {
                let tmpBuffer = Buffer.alloc(4);
                tmpBuffer.writeUInt16LE(read(buffer, Object.assign({}, desc, { type: 'uint16LE' }), offset + 2, frames, length), 0);
                tmpBuffer.writeUInt16LE(read(buffer, Object.assign({}, desc, { type: 'uint16LE' }), offset, frames, length), 2);
                return tmpBuffer.readUInt32LE(0);
            }
            return buffer.readUInt32LE(offset);
        case 'uint64':
        case 'buffer':
        case 'string':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');

            var expectedLength = length;

            if (desc.type == 'uint64')
                length = 8;
            else if (typeof desc['length'] !== 'number' && typeof (desc['length']) !== 'undefined')
            {
                length = frameTypeLength(desc['length']);
                offset += length;
                length = <number>read(buffer, { type: desc['length'], name: '' }, offset - length, frames, subByteOffset);
            }

            if (expectedLength != length && expectedLength !== 0 && typeof (expectedLength) != 'undefined')
                throw new Error('inconsistent requested lengths');

            // let value: Buffer;
            if (typeof (length) != 'undefined' && length >= 0)
                value = buffer.slice(offset, offset + length);
            else
                value = buffer.slice(offset);
            if (desc.type == 'buffer')
                return value;
            return value.toString();
        case 'uint8[]':
        case 'uint16[]':
        case 'uint32[]':
        case 'uint64[]':
        case 'subFrame[]':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            var subType = desc.type.substring(0, desc.type.indexOf('[')) as simpleFrameType | 'subFrame';
            var subLength = frameTypeLength(subType);

            var expectedLength = length;

            if (typeof desc.length !== 'number' && typeof (desc.length) !== 'undefined')
            {
                length = frameTypeLength(desc.length);
                offset += length;
                length = <number>read(buffer, { type: desc.length, name: '' }, offset - length, frames, subByteOffset);
            }

            if (expectedLength != length && expectedLength !== 0 && typeof (expectedLength) != 'undefined')
                throw new Error('inconsistent requested lengths');

            var result = [];
            for (let i = 0; i < length; i++)
            {
                if (length > -1)
                {
                    result.push(read(buffer, { name: '', type: subType as simpleFrameType }, offset, frames, 0));
                    offset += subLength;
                }
                else if (subType == 'subFrame')
                {
                    result.push((desc as SubFrameArrayDescription<any, any>).frame.read(buffer, {}, offset));
                }
            }
            return result;
        case 'subFrame':
            throw new Error('Should be handled in Frame<T>');
        default:
            throw desc.type + ' is not supported';
    }
}

export class Frame<T>
{
    constructor(private frame: FrameDescription<T>[], private prepare?: (message: T) => void)
    {
    }

    public write(message: T)
    {
        if (this.prepare)
            this.prepare(message);
        var buffers: Buffer[] = [];
        let offset = 0;
        let buffer: Buffer;
        for (let frame of this.frame)
        {
            var type = frame.type;
            if (type instanceof Function)
                type = type(message);

            var length = frameTypeLength(type);
            if (frame.optional)
                continue;
            if (length > -1)
            {
                if (offset > 0 || Math.ceil(length) != length + offset)
                {
                    if (offset == 0)
                        buffer = Buffer.alloc(Math.ceil(length))
                    else
                    {
                        let newBuffer = Buffer.alloc(Math.ceil(length + offset));
                        buffer.copy(newBuffer);
                        buffer = newBuffer;
                    }
                    write(buffer, message[frame.name], frame, this.frame, offset)
                    offset += length;
                }
                else
                {
                    buffer = Buffer.alloc(length)
                    write(buffer, message[frame.name], frame, this.frame, offset)
                    offset = 0;
                }
            }
            else
            {
                buffer = write(null, message, frame, this.frame, offset);
            }

            if (buffers[buffer.length - 1] !== buffer && offset == Math.ceil(offset))
                buffers.push(buffer);
        }
        if (offset != Math.ceil(offset))
            buffers.push(buffer);

        return Buffer.concat(buffers);
    }
    public read(buffer: Buffer, instance: T, offset = 0, subByteOffset = 0)
    {
        // console.log(this.frame);
        for (var frame of this.frame)
        {
            var type = frame.type;
            if (type instanceof Function)
            {
                type = type(instance, buffer);
                frame = Object.assign({}, frame, { type })
            }

            var length = frameTypeLength(type);
            if (length > -1)
            {
                instance[frame.name] = <any>read(buffer, frame, offset, this.frame, subByteOffset);
                offset += length;
            }
            else if (frame.type == 'subFrame')
            {
                instance[frame.name] = <any>{};
                if (!frame.choose.subFrame[instance[frame.choose.discriminator] as unknown as number])
                    throw new Error('Unsupported type ' + instance[frame.choose.discriminator]);

                offset = (frame as SubFrameDescription<T, any>).choose.subFrame[instance[(frame as SubFrameDescription<T, any>).choose.discriminator] as any].read(buffer, <any>instance[frame.name], offset)
            }
            else
            {
                if ((frame as ComplexFrameDescription<T>).length > 0)
                    length = instance[this.frame[(frame as ComplexFrameDescription<T>).length].name];

                instance[frame.name] = <any>read(buffer, frame, offset, this.frame, length);
                offset += length;
            }
        }
        return offset;
    }
}

export class Protocol<T>
{
    private subFrameRegistration: { [key in keyof T]: SubFrameDescription<T, any> } = {} as any;
    private frame: Frame<T>;

    constructor(frames: FrameDescription<T>[])
    {
        this.frame = new Frame<T>(frames);
        for (var frame of frames)
        {
            if (frame.type === 'subFrame')
                this.subFrameRegistration[(frame as SubFrameDescription<T, any>).choose.discriminator] = frame as SubFrameDescription<T, any>;
        }
    }

    public register<U={}>(name: keyof T, value: number, description: FrameDescription<U>[], prepare?: (message: U) => void)
    {
        if (typeof (this.subFrameRegistration[name]) == 'undefined')
            throw new Error('No sub frame is registered for ' + name)

        if (typeof (this.subFrameRegistration[name].choose.subFrame[value]) != 'undefined')
            throw new Error(`A sub frame is already registered at ${name} for the value ${value}`);

        this.subFrameRegistration[name].choose.subFrame[value] = new Frame<U>(description, prepare);
    }

    public read(buffer: Buffer): T
    {
        var result: T = {} as any;
        log(`reading ${buffer.toJSON().data}`);
        this.frame.read(buffer, result, 0);
        log(`read ${JSON.stringify(result)}`);
        return result;
    }

    public write(instance: T): Buffer
    {
        log(`writing ${JSON.stringify(instance)}`);
        var buffer = this.frame.write(instance);
        log(`written ${buffer.toJSON().data}`);
        return buffer;
    }
}