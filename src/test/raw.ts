///<reference types="mocha" />
import * as self from '..'
import * as assert from 'assert'
import 'source-map-support/register'

function readType(type: self.simpleFrameType, length: number)
{
    describe(type, function ()
    {
        it('should return ' + length + '/8', function ()
        {
            assert.equal(self.frameTypeLength(type), length / 8);
        })
        it('should read and write from buffer', function ()
        {
            var expected: number = 0;
            for (let i = 0; i < length; i++)
            {
                expected += Math.pow(2, i);
            }
            var buffer = Buffer.from([0xff, 0xff, 0xff, 0xff]);

            for (let i = 0; i < 8; i++)
            {
                if (i + length < 8 || i == 0)
                {
                    assert.strictEqual(self.write(buffer, expected, { type: type, name: 'prop' }, null, i / 8), undefined, 'writing in buffer');
                    assert.deepEqual(self.read(buffer, { type: type, name: 'prop' }, i / 8, null, 0), expected, 'reading ' + i + ' / 8 in buffer');
                }
            }
        })
    })
}

function readArrayType(type: self.simpleFrameType, length: number)
{
    var arrayType: self.complexFrameType = type + '[]' as any;
    describe(arrayType, function ()
    {
        it('should return -1', function ()
        {
            assert.equal(self.frameTypeLength(arrayType), -1);
        })
        it('should read and write from buffer', function ()
        {
            var expectedValue = 0;
            var arrayElementLength = self.frameTypeLength(type);
            for (let i = 0; i < 8 * arrayElementLength; i++)
            {
                expectedValue += Math.pow(2, i);
            }

            var expected: number[] = [];
            for (let i = 0; i < length; i++)
            {
                expected.push(expectedValue);
            }

            var buffer: Buffer;

            assert.notStrictEqual(buffer = self.write(null, expected, { type: arrayType, name: 'prop', length: 'uint8' }, null, 0), undefined, 'writing in buffer');
            assert.deepEqual(self.read(buffer, { type: arrayType, name: 'prop', length: 'uint8' }, 0, null, length), expected, 'reading array in buffer');
        })
    })
}

describe('read', function ()
{
    readType('bit', 1)
    readType('uint2', 2)
    readType('uint3', 3)
    readType('uint4', 4)
    readType('uint5', 5)
    readType('uint6', 6)
    readType('uint7', 7)
    readType('uint8', 8)
    readType('uint16', 16)
    readType('uint32', 32)

    // readArrayType('uint2', 2)
    // readArrayType('uint3', 3)
    // readArrayType('uint4', 4)
    // readArrayType('uint5', 5)
    // readArrayType('uint6', 6)
    // readArrayType('uint7', 7)
    readArrayType('uint8', 4)
    readArrayType('uint16', 4)
    readArrayType('uint32', 4)

    describe('string', function ()
    {
        it('should return -1', function ()
        {
            assert.equal(self.frameTypeLength('string'), -1);
        })
        it('should read from buffer', function ()
        {
            var expected = 'string'
            var buffer: Buffer;
            assert.notStrictEqual(buffer = self.write(null, expected, { type: 'string', name: 'prop', length: 'uint8' }, null, 0), undefined, 'writing in buffer');
            assert.equal(self.read(buffer, { type: 'string', name: 'prop', length: 'uint8' }, 0, null, 0), 'string', 'reading in buffer');
        })
    })

    describe('uint64', function ()
    {
        it('should return 8', function ()
        {
            assert.equal(self.frameTypeLength('uint64'), 8);
        })
        it('should read from buffer', function ()
        {
            var expected = 'string12'
            var buffer = Buffer.alloc(8);

            assert.strictEqual(self.write(buffer, expected, { type: 'uint64', name: 'prop' }, null, 0), undefined, 'writing in buffer');
            assert.equal(self.read(buffer, { type: 'uint64', name: 'prop' }, 0, null, 0), expected, 'reading in buffer');
        })
    })
})
