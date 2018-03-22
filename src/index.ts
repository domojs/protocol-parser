import * as debug from 'debug'
const log = debug('domojs:protocol-parser');

export type uint8 = number;
export type uint16 = number;
export type uint32 = number;
export type uint64 = string;
export type int8 = number;
export type int16 = number;
export type int32 = number;
export type float = number;
export type double = number;

export type simpleFrameType = 'uint8' | 'uint16' | 'uint32' | 'uint64';
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
    log(`writing ${JSON.stringify(value)} from ${JSON.stringify(desc)}`);

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

    switch (type)
    {
        case 'uint8':
            buffer.writeUInt8(value, offset);
            break;
        case 'uint16':
            buffer.writeUInt16BE(value, offset);
            break;
        case 'uint32':
            buffer.writeUInt32BE(value, offset);
            break;
        case 'uint64':
            buffer.write(value, offset);
            break;
        case 'uint8[]':
        case 'uint16[]':
        case 'uint32[]':
        case 'uint64[]':
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
        switch (desc.type)
        {
            case 'uint8':
                return buffer.readUInt8(offset);
            case 'uint16':
                return buffer.readUInt16BE(offset);
            case 'uint32':
                return buffer.readUInt32BE(offset);
            case 'uint64':
            case 'buffer':
            case 'string':
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
                var subType = desc.type.substring(0, desc.type.indexOf('[')) as simpleFrameType | 'subFrame';
                var subLength = frameTypeLength(subType);
                var result = [];
                for (let i = 0; i < length; i++)
                {
                    if (length > -1)
                    {
                        result.push(read(buffer, { name: '', type: subType as simpleFrameType }, offset, frames));
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
        for (let frame of this.frame)
        {
            var type = frame.type;
            if (type instanceof Function)
                type = type(message);

            var length = frameTypeLength(type);
            let offset = 0;
            let buffer: Buffer;
            if (frame.optional)
                continue;
            if (length > -1)
            {
                write(buffer = Buffer.alloc(length), message[frame.name], frame, this.frame, offset)
            }
            else
            {
                buffer = write(null, message, frame, this.frame, offset);

            }
            buffers.push(buffer);
        }
        return Buffer.concat(buffers);
    }
    public read(buffer: Buffer, instance: T, offset = 0)
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
                instance[frame.name] = <any>read(buffer, frame, offset, this.frame);
                offset += length;
            }
            else if (type == 'subFrame')
            {
                instance[frame.name] = <any>{};
                (frame as SubFrameDescription<T, any>).choose.subFrame[instance[(frame as SubFrameDescription<T, any>).choose.discriminator] as any].read(buffer, <any>instance[frame.name], offset)
            }
            else
            {
                if (isNaN((frame as ComplexFrameDescription<T>).length as any))
                    length = frameTypeLength((frame as ComplexFrameDescription<T>).length as complexFrameType);
                else
                    length = instance[this.frame[(frame as ComplexFrameDescription<T>).length].name];

                offset += length;
                length = <number>read(buffer, frame, offset - length, this.frame);
                instance[frame.name] = <any>read(buffer, frame, offset, this.frame, length);
                offset += length;
            }
        }
    }
}

export class Protocol<T>
{
    private subFrameRegistration: {[key in keyof T]: SubFrameDescription<T, any> } = {} as any;
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