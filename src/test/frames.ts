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

describe('frame', function ()
{
    it('should read and write from buffer', function ()
    {
        var expected: TestType = { length: 10, type: 5, sequenceNumber: 0, raw: Buffer.from([0xff, 0xf5, 0x5f, 0x55]) }
        var protocol = new self.Protocol(frame);
        debugger;
        var buffer = protocol.write(expected);
        assert.deepEqual(protocol.read(buffer), expected, 'frame writing and reading');
    })
})