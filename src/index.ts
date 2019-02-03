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

export type simpleFrameType = 'bit' | 'uint2' | 'uint3' | 'uint4' | 'uint5' | 'uint6' | 'uint7' | 'uint8' | 'uint16' | 'uint32' | 'uint64';
export type complexFrameType = 'string' | 'buffer' | 'uint8[]' | 'uint16[]' | 'uint32[]' | 'uint64[]';;
export type frameType = simpleFrameType | complexFrameType | 'subFrame' | 'subFrame[]';
export type frameTypeGetter<T, U extends frameType> = ((instance: T, buffer?: Buffer) => U);

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
export function frameTypeLength(type: 'uint32'): 4
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
            return 2;
        case 'uint32':
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

function write(buffer: Buffer, value: any, desc: FrameDescription<any>, fullFrame: FrameDescription<any>[], offset: number = 0)
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
        type = type.substring(0, type.indexOf('[')) + ']' as complexFrameType;
    }

    var floorOffset = Math.floor(offset);
    var subByteOffset = (offset - floorOffset) * 8;

    switch (type)
    {
        case 'bit':
            var currentValue = buffer.readUInt8(floorOffset);
            value = value && 1 || 0 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint2':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 6)
                throw new Error('Cross byte value are not supported');
            value = value % 4 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint3':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 5)
                throw new Error('Cross byte value are not supported');
            value = value % 8 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint4':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 4)
                throw new Error('Cross byte value are not supported');
            value = value % 16 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint5':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 3)
                throw new Error('Cross byte value are not supported');
            value = value % 32 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint6':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 2)
                throw new Error('Cross byte value are not supported');
            value = value % 64 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint7':
            var currentValue = buffer.readUInt8(floorOffset);
            if (subByteOffset > 1)
                throw new Error('Cross byte value are not supported');
            value = value % 128 << subByteOffset;
            buffer.writeUInt8(currentValue | value, floorOffset);
            break;
        case 'uint8':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            buffer.writeUInt8(value, offset);
            break;
        case 'uint16':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            buffer.writeUInt16BE(value, offset);
            break;
        case 'uint32':
            if (offset != floorOffset)
                throw new Error('Cross byte value are not supported');
            buffer.writeUInt32BE(value, offset);
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

                var subType = type.substring(0, type.length - 3) as simpleFrameType;
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
                return value as Buffer;

            if (desc.type == 'buffer')
                (value as Buffer).copy(buffer, offset);
            else
                buffer.write(value, offset);

            return buffer;
        case 'subFrame':
            if (!(value[(desc as SubFrameDescription<any, any>).choose.discriminator] in (desc as SubFrameDescription<any, any>).choose.subFrame))
                return buffer;

            buffer = (desc as SubFrameDescription<any, any>).choose.subFrame[value[(desc as SubFrameDescription<any, any>).choose.discriminator]].write(value[desc.name]);
            if (typeof ((desc as SubFrameDescription<any, any>).length) == 'undefined')
                return buffer;
            var subBuffer = Buffer.alloc(buffer.length + frameTypeLength((desc as SubFrameDescription<any, any>).length));
            buffer.copy(subBuffer, subBuffer.length - buffer.length);
            return write(subBuffer, buffer.length, { type: (desc as SubFrameDescription<any, any>).length, name: '' }, fullFrame, 0);
    }
}

function read(buffer: Buffer, desc: FrameDescription<any>, offset: number, frames: FrameDescription<any>[], length?: number)
{
    try
    {
        var floorOffset = Math.floor(offset);
        var currentValue = buffer.readUInt8(floorOffset);
        var subByteOffset = (offset - floorOffset) * 8;

        switch (desc.type)
        {
            case 'bit':
                switch (subByteOffset)
                {
                    case 0:
                        return currentValue & 0b00000001;
                    case 1:
                        return currentValue & 0b00000010;
                    case 2:
                        return currentValue & 0b00000100;
                    case 3:
                        return currentValue & 0b00001000;
                    case 4:
                        return currentValue & 0b00010000;
                    case 5:
                        return currentValue & 0b00100000;
                    case 6:
                        return currentValue & 0b01000000;
                    case 7:
                        return currentValue & 0b10000000;
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
                }
                break;
            case 'uint4':
                switch (subByteOffset)
                {
                    case 0:
                        return currentValue & 0b00001111;
                    case 1:
                        return currentValue & 0b00011110;
                    case 2:
                        return currentValue & 0b00111100;
                    case 3:
                        return currentValue & 0b01111000;
                    case 4:
                        return currentValue & 0b11110000;
                }
                break;
            case 'uint5':
                switch (subByteOffset)
                {
                    case 0:
                        return currentValue & 0b00011111;
                    case 1:
                        return currentValue & 0b00111110;
                    case 2:
                        return currentValue & 0b01111100;
                    case 3:
                        return currentValue & 0b11111000;
                }
                break;
            case 'uint6':
                switch (subByteOffset)
                {
                    case 0:
                        return currentValue & 0b00111111;
                    case 1:
                        return currentValue & 0b01111110;
                    case 2:
                        return currentValue & 0b11111100;
                }
                break;
            case 'uint7':
                switch (subByteOffset)
                {
                    case 0:
                        return currentValue & 0b01111111;
                    case 1:
                        return currentValue & 0b11111110;
                }
                break;
            case 'uint8':
                if (offset != floorOffset)
                    throw new Error('Cross byte value are not supported');

                return buffer.readUInt8(offset);
            case 'uint16':
                if (offset != floorOffset)
                    throw new Error('Cross byte value are not supported');
                return buffer.readUInt16BE(offset);
            case 'uint32':
                if (offset != floorOffset)
                    throw new Error('Cross byte value are not supported');
                return buffer.readUInt32BE(offset);
            case 'uint64':
            case 'buffer':
            case 'string':
                if (offset != floorOffset)
                    throw new Error('Cross byte value are not supported');
                let value: Buffer;
                if (typeof (length) != 'undefined')
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
                if (desc.type instanceof Function)
                    throw new Error('Not supported');
                var subType = desc.type.substring(0, desc.type.indexOf('[')) as simpleFrameType | 'subFrame';
                var subLength = frameTypeLength(subType);
                var result = [];
                for (let i = 0; i < length; i++)
                {
                    if (length > -1)
                    {
                        result.push(read(buffer, { name: '', type: subType as simpleFrameType }, offset, frames, 0));
                        offset += length;
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
    catch (e)
    {
        return null;
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
                if (Math.ceil(length) != length + offset)
                {
                    buffer = Buffer.alloc(Math.ceil(length))
                    write(buffer, message[frame.name], frame, this.frame, offset)
                    offset += length;
                }
                else
                {
                    buffer = Buffer.alloc(length)
                    write(buffer, message[frame.name], frame, this.frame, offset)
                    offset += 0;
                }
            }
            else
            {
                buffer = write(null, message, frame, this.frame, offset);
            }

            if (buffers[buffer.length - 1] !== buffer)
                buffers.push(buffer);
        }
        return Buffer.concat(buffers);
    }
    public read(buffer: Buffer, instance: T, offset = 0, subByteOffset = 0)
    {
        // console.log(this.frame);
        for (var frame of this.frame)
        {
            var type = frame.type;
            if (type instanceof Function)
                type = type(instance, buffer);

            var length = frameTypeLength(type);
            if (length > -1)
            {
                instance[frame.name] = <any>read(buffer, frame, offset, this.frame, subByteOffset);
                offset += length;
            }
            else if (type == 'subFrame')
            {
                instance[frame.name] = <any>{};
                offset = (frame as SubFrameDescription<T, any>).choose.subFrame[instance[(frame as SubFrameDescription<T, any>).choose.discriminator] as any].read(buffer, <any>instance[frame.name], offset)
            }
            else
            {
                if (isNaN((frame as ComplexFrameDescription<T>).length as any))
                {
                    length = frameTypeLength((frame as ComplexFrameDescription<T>).length as complexFrameType);
                    offset += length;
                    length = <number>read(buffer, { type: (frame as ComplexFrameDescription<T>).length as complexFrameType, name: '' }, offset - length, this.frame, subByteOffset);
                }
                else if ((frame as ComplexFrameDescription<T>).length > 0)
                    length = instance[this.frame[(frame as ComplexFrameDescription<T>).length].name];
                else
                    length = -(frame as ComplexFrameDescription<T>).length;

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