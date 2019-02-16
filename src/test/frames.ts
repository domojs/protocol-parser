///<reference types="mocha" />
import * as self from '..'
import * as assert from 'assert'
import 'source-map-support/register'

interface TestType
{
    length: self.uint8;
    type: self.uint16;
    sequenceNumber: self.uint8;
    raw: Buffer;
}
interface TestType2
{
    length: self.uint8;
    type: self.uint16;
    sequenceNumber: self.uint8;
    message: string;
}
interface SuperType
{
    prop1: self.uint8;
    type: self.uint8;
    sub: TestType | TestType2
}

var frame: self.FrameDescription<TestType>[] = [
    {
        name: 'length',
        type: 'uint8'
    },
    {
        name: 'type',
        type: 'uint16'
    },
    {
        name: 'sequenceNumber',
        type: 'uint8'
    },
    {
        name: 'raw',
        type: 'buffer'
    }
]
var frame2: self.FrameDescription<TestType2>[] = [
    {
        name: 'length',
        type: 'uint8'
    },
    {
        name: 'type',
        type: 'uint16'
    },
    {
        name: 'sequenceNumber',
        type: 'uint8'
    },
    {
        name: 'message',
        type: 'string'
    }
]

var superframe: self.FrameDescription<SuperType>[] = [
    {
        name: 'prop1',
        type: 'uint8'
    },
    {
        name: 'type',
        type: 'uint16'
    },
    {
        name: 'sub',
        type: 'subFrame',
        choose: {
            discriminator: 'type',
            subFrame: {}
        }
    }
]
describe('frame', function ()
{
    it('should read and write from buffer', function ()
    {
        var expected: TestType = { length: 10, type: 5, sequenceNumber: 0, raw: Buffer.from([0xff, 0xf5, 0x5f, 0x55]) }
        var protocol = new self.Protocol(frame);

        var buffer = protocol.write(expected);
        assert.deepEqual(buffer, Buffer.from([10, 0, 5, 0, 0xff, 0xf5, 0x5f, 0x55]))
        assert.deepEqual(protocol.read(buffer), expected, 'frame writing and reading');
    })
})


describe('frame', function ()
{
    it('should read and write from buffer', function ()
    {
        var expected = { sign: 0, value: 167 }
        var protocol = new self.Protocol<typeof expected>([{
            name: 'sign',
            type: 'bit',
        },
        {
            name: 'value',
            type: 'uint16'
        }]);
        var buffer = protocol.write(expected);
        assert.deepEqual(buffer, Buffer.from([0, 78, 1]), 'frame writing')
        assert.deepEqual(protocol.read(buffer), expected, 'frame reading');
    })
})

describe('subframe', function ()
{
    var protocol = new self.Protocol(superframe);
    protocol.register('type', 1, frame);
    protocol.register('type', 2, frame2);
    it('should read and write from buffer', function ()
    {
        var expected: SuperType = { type: 1, prop1: 17, sub: { length: 10, type: 1, sequenceNumber: 0, raw: Buffer.from([0xff, 0xf5, 0x5f, 0x55]) } }
        var buffer = protocol.write(expected);
        assert.deepEqual(buffer, Buffer.from([17, 0, 1, 10, 0, 1, 0, 0xff, 0xf5, 0x5f, 0x55]))
        assert.deepEqual(protocol.read(buffer), expected, 'frame writing and reading');

        var expected: SuperType = { type: 2, prop1: 17, sub: { length: 10, type: 1, sequenceNumber: 0, message: 'Buffer.from([0xff, 0xf5, 0x5f, 0x55]' } }
        var buffer = protocol.write(expected);
        assert.deepEqual(buffer, Buffer.from([17, 0, 2, 10, 0, 1, 0, 66, 117, 102, 102, 101, 114, 46, 102, 114, 111, 109, 40, 91, 48, 120, 102, 102, 44, 32, 48, 120, 102, 53, 44, 32, 48, 120, 53, 102, 44, 32, 48, 120, 53, 53, 93]))
        assert.deepEqual(protocol.read(buffer), expected, 'frame writing and reading');

        var expected: SuperType = { type: 3, prop1: 17, sub: { length: 10, type: 1, sequenceNumber: 0, message: 'Buffer.from([0xff, 0xf5, 0x5f, 0x55]' } }
        try
        {
            protocol.write(expected);
            assert.fail('unsupported type still passing');
        }
        catch (e)
        {
            assert.equal(e.message, 'Unsupported type ' + expected.type)
        }
        try
        {
            assert.deepEqual(expected, protocol.read(Buffer.from([17, 0, 3, 10, 0, 1, 0, 66, 117, 102, 102, 101, 114, 46, 102, 114, 111, 109, 40, 91, 48, 120, 102, 102, 44, 32, 48, 120, 102, 53, 44, 32, 48, 120, 53, 102, 44, 32, 48, 120, 53, 53, 93])))
            assert.fail('unsupported type still passing');
        }
        catch (e)
        {
            assert.equal(e.message, 'Unsupported type ' + expected.type)
        }
    })
})