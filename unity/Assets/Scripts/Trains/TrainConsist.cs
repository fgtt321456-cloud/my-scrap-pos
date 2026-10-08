using System.Collections.Generic;
using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.Trains
{
    /// <summary>
    /// A train as data: an ordered list of pooled cars (index 0 = the end facing the buffer stop).
    /// It is a plain class, recycled through <see cref="ClassPool{T}"/>, so building and tearing down
    /// trains produces no garbage.
    /// </summary>
    public sealed class TrainConsist
    {
        private static readonly ClassPool<TrainConsist> Pool = new ClassPool<TrainConsist>(() => new TrainConsist(), 16);
        private static readonly List<PoolId> CompositionBuffer = new List<PoolId>(12);

        public readonly List<TrainCar> Cars = new List<TrainCar>(12);
        public TrainDefinition Definition { get; private set; }
        public int ServiceNumber { get; private set; }

        public float TotalLength
        {
            get
            {
                float sum = 0f;
                for (int i = 0; i < Cars.Count; i++) sum += Cars[i].Length;
                return sum;
            }
        }

        private TrainConsist() { }

        /// <summary>
        /// Spawns every car from the pools and lays them out behind <paramref name="frontPoint"/>
        /// (its forward axis points toward the buffer stop; cars extend backward along -forward).
        /// </summary>
        public static TrainConsist Build(TrainDefinition def, int serviceNumber, Transform frontPoint, int middleCount = -1)
        {
            var consist = Pool.Get();
            consist.Definition = def;
            consist.ServiceNumber = serviceNumber;

            def.GetComposition(CompositionBuffer, middleCount);
            var pm = PoolManager.Instance;
            Vector3 forward = frontPoint.forward;
            Quaternion rot = frontPoint.rotation;
            Vector3 cursor = frontPoint.position;

            for (int i = 0; i < CompositionBuffer.Count; i++)
            {
                var car = pm.Spawn<TrainCar>(CompositionBuffer[i], cursor, rot);
                if (car == null) continue;
                // Pivot is the car centre: shift by half a length, then the other half for the next car.
                car.CachedTransform.position = cursor - forward * (car.Length * 0.5f);
                // A driving car at the rear of a push-pull set faces the other way.
                if (i == CompositionBuffer.Count - 1 && i > 0 && car.Role == CarRole.Cab)
                    car.CachedTransform.rotation = rot * Quaternion.Euler(0f, 180f, 0f);
                cursor -= forward * car.Length;
                car.Consist = consist;
                consist.Cars.Add(car);
            }
            return consist;
        }

        /// <summary>Removes the locomotive at index 0 for a run-around. The car stays spawned.</summary>
        public TrainCar DetachFront()
        {
            if (Cars.Count == 0) return null;
            var car = Cars[0];
            Cars.RemoveAt(0);
            car.Consist = null;
            return car;
        }

        /// <summary>Couples a car at the far end (after the run-around, the locomotive leads outbound).</summary>
        public void AttachBack(TrainCar car)
        {
            car.Consist = this;
            Cars.Add(car);
        }

        /// <summary>Returns every car (and their cargo) to the pools and recycles this consist object.</summary>
        public void Despawn()
        {
            var pm = PoolManager.Instance;
            for (int i = Cars.Count - 1; i >= 0; i--)
            {
                var car = Cars[i];
                if (car != null && !car.Pooled.IsInPool) pm.Release(car.Pooled);
            }
            Cars.Clear();
            Definition = null;
            ServiceNumber = 0;
            Pool.Release(this);
        }
    }

    /// <summary>Minimal allocation-free pool for plain C# objects (works on any Unity version).</summary>
    public sealed class ClassPool<T> where T : class
    {
        private readonly Stack<T> _free;
        private readonly System.Func<T> _create;

        public ClassPool(System.Func<T> create, int capacity)
        {
            _create = create;
            _free = new Stack<T>(capacity);
            for (int i = 0; i < capacity; i++) _free.Push(create());
        }

        public T Get() { return _free.Count > 0 ? _free.Pop() : _create(); }
        public void Release(T item) { _free.Push(item); }
    }
}
