"""
**Deprecated** (13 Aug 2006)

Layers multiple dictionaries.

Nested dictionaries can be traversed, with each dictionary shadowing
the previous dictionaries.  So for example:

    >>> d = NestedDict([{'foo': 'bar'}])
    >>> d['foo']
    'bar'
    >>> d2 = d.clone(add_dict={'foo': 'bar2'})
    >>> d2['foo']
    'bar2'
    >>> d2.getlist('foo')
    ['bar2', 'bar']

This works for deeply nested dictionaries, not just at the top level;
each nested dictionary gets wrapped in a NestedDict as well.
"""

# This was deprecated 13 Aug 2006
import warnings
warnings.warn('initools.nested is not supported or recommended for use.',
              DeprecationWarning)

from UserDict import DictMixin, UserDict

class NestedDict(DictMixin):

    def __init__(self, configs=None, mutable=True, nest=True):
        if configs is None:
            configs = [{}]
        assert isinstance(configs, (list, tuple)), (
            "The configs must be a list or tuple, not: %r"
            % configs)
        self.configs = configs
        self.mutable = mutable
        self.nest = nest

    def __getitem__(self, key):
        results = self.raw_get(key)
        if not results:
            raise KeyError, "Key not found: %r" % key
        return self._convert_single(key, results)

    def add_config(self, config, position=0):
        assert not isinstance(config, (str, unicode)), (
            "Bad configuration (not a mapping): %r" % config)
        if position is None:
            self.configs.append(config)
        else:
            self.configs.insert(position, config)

    def set_configs(self, new_configs):
        self.configs[:] = []
        for config in new_configs:
            self.add_config(config, None)

    def raw_get(self, key, add_inherited=True):
        results = []
        if add_inherited:
            all_configs = self.configs
        else:
            all_configs = [self.configs[-1]]
        for config in all_configs:
            if key in config:
                if isinstance(config, (str, unicode)):
                    print [key, config, all_configs, self.configs]
                results.append(config[key])
        return results

    def getlist(self, key, add_inherited=True):
        results = self.raw_get(key, add_inherited=add_inherited)
        converted = []
        for result_set in results:
            if not isinstance(result_set, (list, tuple)):
                result_set = [result_set]
            converted.extend(self._convert_many(key, result_set))
        return converted

    def _convert_single(self, key, value_list):
        if (not self.nest
            or not isinstance(value_list[0],
                              (dict, DictMixin, UserDict))):
            # @@: doesn't handle all dict alternatives
            return value_list[0]
        elif len(value_list) == 1 and self.mutable:
            return value_list[0]
        else:
            return self.__class__(
                value_list, mutable=self.mutable, nest=True)

    def _convert_many(self, key, value_list):
        return [self._convert_single(key, [v]) for v in value_list]

    def __setitem__(self, key, value):
        if self.mutable:
            self.configs[0][key] = value
        else:
            raise KeyError, (
                "Dictionary is read-only")

    def __delitem__(self, key):
        if not self.mutable:
            raise KeyError, (
                "Dictionary is read-only")
        if self.configs[0].has_key(key):
            del self.configs[0][key]
        elif self.has_key(key):
            raise KeyError, (
                "You cannot delete the key %r, as it belongs to the "
                "a master configuration %r"
                % (key, self.master))
        else:
            raise KeyError, (
                "Key does not exist: %r" % key)

    def keys(self):
        return list(self)

    def __contains__(self, key):
        for config in self.configs:
            if config.has_key(key):
                return True
        return False

    def has_key(self, key):
        return key in self

    def __iter__(self):
        used = {}
        for config in self.configs:
            for key in config:
                if key in used:
                    continue
                used[key] = None
                yield key

    _clone_sentry = []

    def clone(self, add_dict=None, mutable=_clone_sentry,
              nest=_clone_sentry):
        if mutable is self._clone_sentry:
            mutable = self.mutable
        if nest is self._clone_sentry:
            nest = self.nest
        new = self.configs[:]
        if add_dict is not None:
            new.insert(0, add_dict)
        else:
            new.insert(0, {})
        return self.__class__(new, mutable=mutable, nest=nest)

    def copy(self):
        return dict(self.iteritems())

    def __eq__(self, other):
        if other is None:
            return False
        if (not hasattr(other, 'keys')
            or not hasattr(other, '__getitem__')):
            return False
        for key in other:
            if not key in self:
                return False
        for name, value in self.iteritems():
            if other[name] != value:
                return False
        return True

    def __cmp__(self, other):
        return not self.__eq__(other)

    def __repr__(self):
        return '<%s %r>' % (self.__class__.__name__,
                            dict(self.iteritems()))
